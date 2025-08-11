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
    
    // 控制参数
    runDuration: 30,     // 运行时长(秒)
    stopDuration: 60,    // 停止间隔(秒)
    systemControl: false, // 系统开关状态
    isApplying: false,   // 是否正在应用设置
    
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

  /* ========== 电机控制功能 ========== */

  // 验证运行时长
  validateRunDuration(value) {
    const num = parseInt(value)
    if (isNaN(num)) {
      return { valid: false, message: '请输入有效的数字' }
    }
    if (num < 1 || num > 999) {
      return { valid: false, message: '运行时长应在1-999秒之间' }
    }
    return { valid: true, value: num }
  },

  // 验证停止间隔
  validateStopDuration(value) {
    const num = parseInt(value)
    if (isNaN(num)) {
      return { valid: false, message: '请输入有效的数字' }
    }
    if (num < 0 || num > 999) {
      return { valid: false, message: '停止间隔应在0-999秒之间' }
    }
    return { valid: true, value: num }
  },

  // 运行时长滑块变化
  onRunDurationChange(e) {
    const validation = this.validateRunDuration(e.detail.value)
    if (validation.valid) {
      this.setData({ runDuration: validation.value })
    }
  },

  // 运行时长滑块实时变化
  onRunDurationChanging(e) {
    const validation = this.validateRunDuration(e.detail.value)
    if (validation.valid) {
      this.setData({ runDuration: validation.value })
    }
  },

  // 运行时长输入框变化
  onRunDurationInput(e) {
    const validation = this.validateRunDuration(e.detail.value)
    if (validation.valid) {
      this.setData({ runDuration: validation.value })
    }
  },

  // 运行时长输入框失焦验证
  onRunDurationBlur(e) {
    const validation = this.validateRunDuration(e.detail.value)
    if (validation.valid) {
      this.setData({ runDuration: validation.value })
    } else {
      wx.showToast({
        title: validation.message,
        icon: 'none'
      })
      // 恢复有效值
      this.setData({ runDuration: 30 })
    }
  },

  // 停止间隔滑块变化
  onStopDurationChange(e) {
    const validation = this.validateStopDuration(e.detail.value)
    if (validation.valid) {
      this.setData({ stopDuration: validation.value })
    }
  },

  // 停止间隔滑块实时变化
  onStopDurationChanging(e) {
    const validation = this.validateStopDuration(e.detail.value)
    if (validation.valid) {
      this.setData({ stopDuration: validation.value })
    }
  },

  // 停止间隔输入框变化
  onStopDurationInput(e) {
    const validation = this.validateStopDuration(e.detail.value)
    if (validation.valid) {
      this.setData({ stopDuration: validation.value })
    }
  },

  // 停止间隔输入框失焦验证
  onStopDurationBlur(e) {
    const validation = this.validateStopDuration(e.detail.value)
    if (validation.valid) {
      this.setData({ stopDuration: validation.value })
    } else {
      wx.showToast({
        title: validation.message,
        icon: 'none'
      })
      // 恢复有效值
      this.setData({ stopDuration: 60 })
    }
  },

  // 系统开关变化
  async onSystemSwitchChange(e) {
    const systemControl = e.detail.value
    
    // 如果未连接设备，不允许切换
    if (this.data.connectionStatus !== 'connected' || !this.data.deviceId) {
      this.setData({ systemControl: false })
      this.showErrorToast('请先连接设备')
      return
    }

    // 显示确认对话框
    const action = systemControl ? '启动' : '停止'
    wx.showModal({
      title: '确认操作',
      content: `确定要${action}电机吗？`,
      success: async (res) => {
        if (res.confirm) {
          this.setData({ systemControl })
          
          try {
            await Ble.setSystemControl(this.data.deviceId, systemControl ? 1 : 0)
            console.log('系统控制状态已更新:', systemControl)
            this.showSuccessToast(`${action}成功`)
            
            // 立即刷新状态
            await this.refreshSystemStatus()
            
          } catch (error) {
            console.error('设置系统控制状态失败:', error)
            
            let errorMessage = '设置失败，请重试'
            if (error.errCode === 10004) {
              errorMessage = '设备通信失败，请检查连接'
            } else if (error.errCode === 10006) {
              errorMessage = '设备连接已断开'
            }
            
            this.showErrorToast(errorMessage)
            // 恢复开关状态
            this.setData({ systemControl: !systemControl })
          }
        } else {
          // 用户取消，恢复开关状态
          this.setData({ systemControl: !systemControl })
        }
      }
    })
  },

  // 显示错误提示
  showErrorToast(message) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    })
  },

  // 显示成功提示
  showSuccessToast(message) {
    wx.showToast({
      title: message,
      icon: 'success',
      duration: 1500
    })
  },

  // 应用设置
  async onApplySettings() {
    if (!this.data.deviceId || this.data.connectionStatus !== 'connected') {
      this.showErrorToast('请先连接设备')
      return
    }

    // 验证参数
    const runValidation = this.validateRunDuration(this.data.runDuration)
    const stopValidation = this.validateStopDuration(this.data.stopDuration)

    if (!runValidation.valid) {
      this.showErrorToast(runValidation.message)
      return
    }

    if (!stopValidation.valid) {
      this.showErrorToast(stopValidation.message)
      return
    }

    this.setData({ isApplying: true })

    try {
      // 发送运行时长
      await Ble.setRunDuration(this.data.deviceId, this.data.runDuration)
      
      // 发送停止间隔
      await Ble.setStopDuration(this.data.deviceId, this.data.stopDuration)
      
      this.showSuccessToast('设置已应用')
      
      // 立即刷新状态
      await this.refreshSystemStatus()
      
    } catch (error) {
      console.error('应用设置失败:', error)
      
      let errorMessage = '设置失败，请重试'
      
      // 根据错误类型提供更具体的错误信息
      if (error.errCode === 10004) {
        errorMessage = '设备通信失败，请检查连接'
      } else if (error.errCode === 10006) {
        errorMessage = '设备连接已断开'
      } else if (error.errCode === 10012) {
        errorMessage = '设备未响应，请重试'
      } else if (error.errMsg && error.errMsg.includes('write')) {
        errorMessage = '写入失败，请检查设备状态'
      }
      
      this.showErrorToast(errorMessage)
    } finally {
      this.setData({ isApplying: false })
    }
  },

  // 恢复默认设置
  async onResetSettings() {
    if (!this.data.deviceId || this.data.connectionStatus !== 'connected') {
      this.showErrorToast('请先连接设备')
      return
    }

    const defaultSettings = {
      runDuration: 30,
      stopDuration: 60,
      systemControl: false
    }
    
    this.setData(defaultSettings)
    
    try {
      await Ble.setRunDuration(this.data.deviceId, defaultSettings.runDuration)
      await Ble.setStopDuration(this.data.deviceId, defaultSettings.stopDuration)
      await Ble.setSystemControl(this.data.deviceId, defaultSettings.systemControl ? 1 : 0)
      
      this.showSuccessToast('已恢复默认设置')
      
      // 立即刷新状态
      await this.refreshSystemStatus()
      
    } catch (error) {
      console.error('恢复默认设置失败:', error)
      
      let errorMessage = '恢复失败，请重试'
      
      // 根据错误类型提供更具体的错误信息
      if (error.errCode === 10004) {
        errorMessage = '设备通信失败，请检查连接'
      } else if (error.errCode === 10006) {
        errorMessage = '设备连接已断开'
      } else if (error.errCode === 10012) {
        errorMessage = '设备未响应，请重试'
      }
      
      this.showErrorToast(errorMessage)
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
      
      // 格式化显示数据
      const formattedStatusData = {
        ...statusData,
        formattedUptime: this.formatUptime(statusData.uptime),
        formattedFreeHeap: this.formatMemory(statusData.freeHeap)
      }
      
      // 更新本地控制参数
      this.setData({
        systemStatus: formattedStatusData,
        runDuration: statusData.runDuration,
        stopDuration: statusData.stopDuration,
        systemControl: statusData.state === 1 || statusData.state === 3 // 运行中或启动中视为开启
      })
      
    } catch (error) {
      console.error('获取系统状态失败:', error)
      
      // 根据错误类型处理
      let errorMessage = '获取状态失败'
      
      if (error.errCode === 10004) {
        errorMessage = '设备通信失败'
      } else if (error.errCode === 10006) {
        errorMessage = '设备连接已断开'
      } else if (error.errCode === 10012) {
        errorMessage = '设备未响应'
      }
      
      // 如果获取状态失败，可能是连接断开了
      if (error.errCode === 10004 || error.errCode === 10006 || error.errCode === 10012) {
        this.setData({
          connectionStatus: 'disconnected',
          deviceId: '',
          deviceName: '',
          buttonText: '扫描设备',
          errorMessage: errorMessage
        })
        this.stopStatusRefresh()
        
        // 显示错误提示
        this.showErrorToast(errorMessage)
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
