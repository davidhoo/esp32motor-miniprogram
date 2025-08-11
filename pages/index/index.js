import Ble from '../../utils/ble.js'

Page({
  data: {
    // 连接状态
    connectionStatus: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'failed'
    deviceId: '',
    deviceName: '',
    devices: [],
    showDeviceList: false,
    isScanning: false,
    isConnecting: false,
    errorMessage: '',
    scanTimeout: null,
    buttonText: '扫描设备',
    
    // 系统状态数据
    systemStatus: {
      state: 0,                    // 状态码 (0=停止, 1=运行中, 2=暂停, 3=启动中)
      stateName: 'STOPPED',        // 状态名称
      remainingRunTime: 0,         // 剩余运行时间(秒)
      remainingStopTime: 0,        // 剩余停止时间(秒)
      currentCycleCount: 0,        // 当前循环计数
      runDuration: 30,             // 运行持续时间设置(秒)
      stopDuration: 60,            // 停止持续时间设置(秒)
      cycleCount: 0,               // 总循环计数设置
      autoStart: false,            // 自动启动标志
      uptime: 0,                   // 系统运行时间(秒)
      freeHeap: 0,                 // 空闲堆内存(字节)
      formattedUptime: '00:00:00', // 格式化的运行时间显示
      formattedFreeHeap: '0KB'     // 格式化的内存显示
    },
    
    // 状态刷新定时器
    statusTimer: null
  },

  onLoad() {
    // 初始化蓝牙适配器
    this.initBluetooth()
  },

  onUnload() {
    // 清除定时器
    if (this.data.statusTimer) {
      clearInterval(this.data.statusTimer)
    }
    
    // 断开连接
    if (this.data.deviceId) {
      Ble.disconnectDevice(this.data.deviceId)
    }
  },

  /* ========== 蓝牙连接管理 ========== */

  // 初始化蓝牙
  initBluetooth() {
    wx.openBluetoothAdapter({
      success: () => {
        console.log('蓝牙适配器初始化成功')
      },
      fail: (err) => {
        console.error('蓝牙适配器初始化失败:', err)
        this.setData({
          errorMessage: '请开启手机蓝牙功能'
        })
      }
    })

    // 监听蓝牙状态变化
    wx.onBluetoothAdapterStateChange((res) => {
      if (!res.available) {
        this.setData({
          connectionStatus: 'disconnected',
          errorMessage: '蓝牙已关闭'
        })
      }
    })

    // 监听连接状态变化
    wx.onBLEConnectionStateChange((res) => {
      if (res.deviceId === this.data.deviceId) {
        if (!res.connected) {
          this.setData({
            connectionStatus: 'disconnected',
            deviceId: '',
            deviceName: '',
            errorMessage: '设备连接已断开'
          })
        }
      }
    })
  },

  // 连接/断开设备
  async onConnect() {
    if (this.data.connectionStatus === 'connected') {
      // 断开连接
      await this.disconnectDevice()
    } else {
      // 连接设备
      if (this.data.deviceId) {
        await this.connectToDevice(this.data.deviceId, this.data.deviceName)
      } else {
        this.scanDevices()
      }
    }
  },

  // 扫描设备
  // 扫描设备
  async scanDevices() {
    this.setData({
      isScanning: true,
      errorMessage: '',
      devices: [],
      showDeviceList: false,
      buttonText: '扫描设备中...'
    })
    // 设置2分钟超时
    const scanTimeout = setTimeout(() => {
      if (this.data.isScanning) {
        this.setData({
          isScanning: false,
          errorMessage: '扫描超时，未找到ESP32-Motor设备',
          buttonText: '扫描设备'
        })
      }
    }, 120000)

    this.setData({ scanTimeout })

    try {
      const devices = await Ble.scanDevices()
      
      // 清除超时定时器
      if (this.data.scanTimeout) {
        clearTimeout(this.data.scanTimeout)
        this.setData({ scanTimeout: null })
      }

      this.setData({
        devices,
        showDeviceList: true,
        isScanning: false,
        buttonText: '扫描设备'
      })

      if (devices.length === 0) {
        this.setData({
          errorMessage: '未找到ESP32-Motor设备，请确保设备已开启'
        })
      }
    } catch (error) {
      console.error('扫描设备失败:', error)
      
      // 清除超时定时器
      if (this.data.scanTimeout) {
        clearTimeout(this.data.scanTimeout)
        this.setData({ scanTimeout: null })
      }

      this.setData({
        errorMessage: '扫描设备失败，请重试',
        isScanning: false,
        buttonText: '扫描设备'
      })
    }
  },


  // 选择设备
  onSelectDevice(e) {
    const { deviceId, deviceName } = e.currentTarget.dataset
    this.setData({
      deviceId,
      deviceName,
      showDeviceList: false
    })
    this.connectToDevice(deviceId, deviceName)
  },

  // 连接到指定设备
  async connectToDevice(deviceId, deviceName) {
    this.setData({
      connectionStatus: 'connecting',
      isConnecting: true,
      errorMessage: '',
      buttonText: '连接中...'
    })

    try {
      // 使用带重试机制的连接
      await Ble.connectDeviceWithRetry(deviceId, 3, 1000)
      
      // 验证连接状态
      const isConnected = await Ble.verifyConnection(deviceId)
      if (!isConnected) {
        throw new Error('连接验证失败')
      }
      
            this.setData({
              connectionStatus: 'connected',
              deviceId,
              deviceName,
              isConnecting: false,
              errorMessage: '',
              buttonText: '断开连接'
            })
            
            // 连接成功后开始状态刷新
            this.startStatusRefresh()
      
    } catch (error) {
      console.error('连接设备失败:', error)
      let errorMessage = '连接失败，请重试'
      
      // 根据错误代码提供更具体的错误信息
      if (error.errCode === 10004) {
        errorMessage = '设备服务获取失败，请检查设备是否正常工作'
      } else if (error.errCode === 10006) {
        errorMessage = '设备连接超时，请确保设备在附近'
      } else if (error.errCode === 10012) {
        errorMessage = '连接失败，请重新扫描设备'
      }
      
            this.setData({
              connectionStatus: 'failed',
              isConnecting: false,
              errorMessage,
              buttonText: '扫描设备'
            })
    }
  },


  // 断开设备连接
  async disconnectDevice() {
    if (!this.data.deviceId) return

    try {
      await Ble.disconnectDevice(this.data.deviceId)
            this.setData({
              connectionStatus: 'disconnected',
              deviceId: '',
              deviceName: '',
              buttonText: '扫描设备'
            })
            
            // 断开连接后停止状态刷新
            this.stopStatusRefresh()
    } catch (error) {
      console.error('断开连接失败:', error)
    }
  },

  /* ========== 系统状态管理 ========== */

  // 开始状态刷新
  startStatusRefresh() {
    // 清除之前的定时器
    if (this.data.statusTimer) {
      clearInterval(this.data.statusTimer)
    }
    
    // 立即获取一次状态
    this.refreshSystemStatus()
    
    // 设置定时器，每1秒刷新一次
    const timer = setInterval(() => {
      this.refreshSystemStatus()
    }, 1000)
    
    this.setData({
      statusTimer: timer
    })
  },

  // 停止状态刷新
  stopStatusRefresh() {
    if (this.data.statusTimer) {
      clearInterval(this.data.statusTimer)
      this.setData({
        statusTimer: null
      })
    }
  },

  // 刷新系统状态
  async refreshSystemStatus() {
    if (this.data.connectionStatus !== 'connected' || !this.data.deviceId) {
      return
    }

    try {
      const statusData = await Ble.getSystemStatus(this.data.deviceId)
      console.log('=== 页面接收到的状态数据 ===')
      console.log('原始statusData:', statusData)
      console.log('各字段值:')
      console.log('  state:', statusData.state, '(类型:', typeof statusData.state, ')')
      console.log('  stateName:', statusData.stateName, '(类型:', typeof statusData.stateName, ')')
      console.log('  remainingRunTime:', statusData.remainingRunTime, '(类型:', typeof statusData.remainingRunTime, ')')
      console.log('  remainingStopTime:', statusData.remainingStopTime, '(类型:', typeof statusData.remainingStopTime, ')')
      console.log('  currentCycleCount:', statusData.currentCycleCount, '(类型:', typeof statusData.currentCycleCount, ')')
      console.log('  runDuration:', statusData.runDuration, '(类型:', typeof statusData.runDuration, ')')
      console.log('  stopDuration:', statusData.stopDuration, '(类型:', typeof statusData.stopDuration, ')')
      console.log('  cycleCount:', statusData.cycleCount, '(类型:', typeof statusData.cycleCount, ')')
      console.log('  autoStart:', statusData.autoStart, '(类型:', typeof statusData.autoStart, ')')
      console.log('  uptime:', statusData.uptime, '(类型:', typeof statusData.uptime, ')')
      console.log('  freeHeap:', statusData.freeHeap, '(类型:', typeof statusData.freeHeap, ')')
      
      // 格式化显示数据
      const formattedStatusData = {
        ...statusData,
        formattedUptime: this.formatUptime(statusData.uptime),
        formattedFreeHeap: this.formatMemory(statusData.freeHeap)
      }
      
      console.log('格式化后的数据:', formattedStatusData)
      console.log('当前页面systemStatus:', this.data.systemStatus)
      console.log('当前页面systemStatus:', this.data.systemStatus)
      
      this.setData({
        systemStatus: formattedStatusData
      })
      
      console.log('setData后的systemStatus:', this.data.systemStatus)
      
    } catch (error) {
      console.error('获取系统状态失败:', error)
      // 如果获取状态失败，可能是连接断开了
      if (error.errCode === 10004 || error.errCode === 10006) {
        this.setData({
          connectionStatus: 'disconnected',
          deviceId: '',
          deviceName: '',
          buttonText: '扫描设备',
          errorMessage: '设备连接已断开'
        })
        this.stopStatusRefresh()
      }
    }
  },

  // 格式化运行时间显示（输入为毫秒数）
  formatUptime(milliseconds) {
    if (milliseconds === 0) return '0秒'
    
    // 将毫秒转换为秒
    const totalSeconds = Math.floor(milliseconds / 1000)
    
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    
    let result = ''
    
    if (days > 0) {
      result += `${days}天`
    }
    if (hours > 0) {
      result += `${hours}小时`
    }
    if (minutes > 0) {
      result += `${minutes}分`
    }
    if (secs > 0 || result === '') {
      result += `${secs}秒`
    }
    
    return result
  },

  // 格式化内存显示
  formatMemory(bytes) {
    if (bytes === 0) return '0KB'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i]
  },

  // 获取状态显示信息
  getStatusDisplay(state, stateName) {
    const statusMap = {
      0: { text: '已停止', color: '#ff4757', icon: '🔴' },
      1: { text: '运行中', color: '#2ed573', icon: '🟢' },
      2: { text: '已暂停', color: '#ffa502', icon: '🟡' },
      3: { text: '启动中', color: '#3742fa', icon: '🔵' }
    }
    
    return statusMap[state] || {
      text: stateName || '未知',
      color: '#747d8c',
      icon: '⚪'
    }
  }

})
