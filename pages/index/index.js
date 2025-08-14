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
    isApplying: false,   // 是否正在应用设置
    
    // 调速器控制参数
    frequency: 1000,        // 频率 (Hz)
    dutyCycle: 50,          // 占空比 (0-100%)
    minOutput: 10,          // 最小输出百分比 (0-50%)
    maxOutput: 100,         // 最大输出百分比 (60-100%)
    softStartTime: 50,      // 缓启动时间 (0.1秒单位, 50=5秒)
    softStopTime: 30,       // 缓停止时间 (0.1秒单位, 30=3秒)
    externalSwitch: false,  // 外接开关功能: true=开启, false=关闭
    analogControl: false,   // 0-10V控制功能: true=开启, false=关闭
    powerOnState: false,    // 开机默认状态: true=运行, false=停止
    isSpeedApplying: false, // 是否正在应用调速器设置
    
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
      chipTemperature: 0,          // 芯片温度(摄氏度)
      formattedUptime: '00:00:00', // 格式化的运行时间显示
      formattedFreeHeap: '0KB',    // 格式化的内存显示
      // systemControl字段已删除
    },
    
    
    // 状态刷新定时器
    statusTimer: null,
    // 自动重试相关
    autoRetryTimer: null,
    retryCount: 0,
    maxRetryCount: 10, // 2分钟内最多重试10次（每12秒一次）
    retryInterval: 12000 // 12秒重试间隔
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
    
    // 清除自动重试定时器
    if (this.data.autoRetryTimer) {
      clearTimeout(this.data.autoRetryTimer)
    }
    
    // 清除扫描超时定时器
    if (this.data.scanTimeout) {
      clearTimeout(this.data.scanTimeout)
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
            buttonText: '扫描设备',
            errorMessage: '设备连接已断开'
          })
          
          // 停止状态刷新
          this.stopStatusRefresh()
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
    // 如果已经在扫描中，不重复启动
    if (this.data.isScanning && this.data.retryCount === 0) {
      return
    }

    this.setData({
      isScanning: true,
      errorMessage: '',
      devices: [],
      showDeviceList: false,
      buttonText: '扫描设备中...'
    })

    try {
      const devices = await Ble.scanDevices()
      
      if (devices.length === 0) {
        // 没有找到设备，继续自动重试状态
        this.setData({
          devices: [],
          showDeviceList: false,
          isScanning: true,
          buttonText: '扫描设备中...'
        })
        // 启动自动重试
        this.startAutoRetry()
      } else {
        // 找到设备，停止自动重试
        this.stopAutoRetry()
        this.setData({
          devices,
          showDeviceList: true,
          isScanning: false,
          buttonText: '扫描设备'
        })
      }
    } catch (error) {
      console.error('扫描设备失败:', error)
      
      // 扫描失败，继续自动重试状态
      this.setData({
        errorMessage: '扫描设备失败，将自动重试...',
        isScanning: true,
        buttonText: '扫描设备中...'
      })
      
      // 扫描失败，启动自动重试
      this.startAutoRetry()
    }
  },

  // 启动自动重试
  startAutoRetry() {
    // 清除之前的重试定时器
    this.stopAutoRetry()
    
    // 重置重试计数，保持扫描状态
    this.setData({
      retryCount: 0,
      isScanning: true,
      buttonText: '扫描设备中...'
    })
    
    const doRetry = () => {
      if (this.data.retryCount >= this.data.maxRetryCount) {
        // 达到最大重试次数
        this.setData({
          errorMessage: '2分钟内未找到设备，请检查设备是否开启',
          buttonText: '扫描设备',
          isScanning: false
        })
        this.stopAutoRetry()
        return
      }

      this.setData({
        retryCount: this.data.retryCount + 1,
        errorMessage: `正在自动重试扫描...(${this.data.retryCount}/${this.data.maxRetryCount})`,
        isScanning: true,
        buttonText: '扫描设备中...'
      })

      console.log(`自动重试扫描第 ${this.data.retryCount} 次`)
      
      // 执行扫描
      this.scanDevices()
    }

    // 设置定时器，按指定间隔重试
    const autoRetryTimer = setTimeout(doRetry, this.data.retryInterval)
    this.setData({ autoRetryTimer })
  },

  // 停止自动重试
  stopAutoRetry() {
    if (this.data.autoRetryTimer) {
      clearTimeout(this.data.autoRetryTimer)
      this.setData({ autoRetryTimer: null })
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
      
      // 首次连接成功后同步电机控制参数和调速器参数
      setTimeout(() => {
        this.syncMotorControlParams()
        this.syncSpeedControllerParams()
      }, 500)
      
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

  // 运行时长增加按钮
  onRunDurationIncrease() {
    const newValue = this.data.runDuration + 1
    const validation = this.validateRunDuration(newValue)
    if (validation.valid) {
      this.setData({ runDuration: validation.value })
    }
  },

  // 运行时长减少按钮
  onRunDurationDecrease() {
    const newValue = this.data.runDuration - 1
    const validation = this.validateRunDuration(newValue)
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
      // 默认值逻辑已删除
    }
  },

  // 停止间隔增加按钮
  onStopDurationIncrease() {
    const newValue = this.data.stopDuration + 1
    const validation = this.validateStopDuration(newValue)
    if (validation.valid) {
      this.setData({ stopDuration: validation.value })
    }
  },

  // 停止间隔减少按钮
  onStopDurationDecrease() {
    const newValue = this.data.stopDuration - 1
    const validation = this.validateStopDuration(newValue)
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
      // 默认值逻辑已删除
    }
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

  // 应用设置到BLE设备
  async onApplySettings() {
    if (this.data.connectionStatus !== 'connected' || !this.data.deviceId) {
      this.showErrorToast('请先连接设备')
      return
    }

    // 验证输入值
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
      // 设置运行时长
      await Ble.setRunDuration(this.data.deviceId, this.data.runDuration)
      
      // 设置停止间隔
      await Ble.setStopDuration(this.data.deviceId, this.data.stopDuration)
      
      this.showSuccessToast('设置已应用')
      
      // 应用成功后刷新系统状态
      setTimeout(() => {
        this.refreshSystemStatus()
      }, 500)
      
    } catch (error) {
      console.error('应用设置失败:', error)
      let errorMessage = '设置失败，请重试'
      
      if (error.errCode === 10004) {
        errorMessage = '设备通信失败'
      } else if (error.errCode === 10006) {
        errorMessage = '设备连接已断开'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      this.showErrorToast(errorMessage)
    } finally {
      this.setData({ isApplying: false })
    }
  },

  /* ========== 系统状态管理 ========== */
  // 系统开关控制功能已删除

  // 同步设备参数功能已删除

  // 开始状态刷新
  startStatusRefresh() {
    // 清除之前的定时器
    this.stopStatusRefresh()
    
    // 立即获取一次状态
    this.refreshSystemStatus()
    this.syncSpeedControllerParams() // 立即同步调速器参数
    
    // 设置定时器，每1秒刷新一次（只刷新系统状态，不刷新调速器参数）
    const timer = setInterval(() => {
      this.refreshSystemStatus()
    }, 1000)
    
    this.setData({
      statusTimer: timer
    })
  },

  // 同步电机控制参数
  syncMotorControlParams() {
    const { systemStatus } = this.data
    if (systemStatus && systemStatus.runDuration && systemStatus.stopDuration) {
      this.setData({
        runDuration: systemStatus.runDuration,
        stopDuration: systemStatus.stopDuration
      })
      console.log('已同步电机控制参数:', {
        runDuration: systemStatus.runDuration,
        stopDuration: systemStatus.stopDuration
      })
    }
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
      // 获取系统状态（不再获取系统控制状态）
      const statusData = await Ble.getSystemStatus(this.data.deviceId)
      
      // 格式化显示数据
      const formattedStatusData = {
        ...statusData,
        chipTemperature: Math.round(statusData.chipTemperature || 0),
        formattedUptime: this.formatUptime(statusData.uptime),
        formattedFreeHeap: this.formatMemory(statusData.freeHeap)
      }
      
      // 更新系统状态展示区域
      this.setData({
        systemStatus: formattedStatusData
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
  },

  /* ========== 调速器控制功能 ========== */

  // 验证频率值
  validateFrequency(value) {
    const num = parseInt(value)
    if (isNaN(num)) {
      return { valid: false, message: '请输入有效的数字' }
    }
    if (num < 1 || num > 10000) { // 假设频率范围为1-10000Hz
      return { valid: false, message: '频率应在1-10000Hz之间' }
    }
    return { valid: true, value: num }
  },

  // 验证占空比值
  validateDutyCycle(value) {
    const num = parseInt(value)
    if (isNaN(num)) {
      return { valid: false, message: '请输入有效的数字' }
    }
    if (num < 0 || num > 100) {
      return { valid: false, message: '占空比应在0-100%之间' }
    }
    return { valid: true, value: num }
  },

  // 验证最小输出值
  validateMinOutput(value) {
    const num = parseInt(value)
    if (isNaN(num)) {
      return { valid: false, message: '请输入有效的数字' }
    }
    if (num < 0 || num > 50) {
      return { valid: false, message: '最小输出应在0-50%之间' }
    }
    return { valid: true, value: num }
  },

  // 验证最大输出值
  validateMaxOutput(value) {
    const num = parseInt(value)
    if (isNaN(num)) {
      return { valid: false, message: '请输入有效的数字' }
    }
    if (num < 60 || num > 100) {
      return { valid: false, message: '最大输出应在60-100%之间' }
    }
    return { valid: true, value: num }
  },

  // 验证缓启动时间值
  validateSoftStartTime(value) {
    const num = parseInt(value)
    if (isNaN(num)) {
      return { valid: false, message: '请输入有效的数字' }
    }
    if (num < 0 || num > 1000) { // 假设最大1000个0.1秒单位，即100秒
      return { valid: false, message: '缓启动时间应在0-1000单位之间' }
    }
    return { valid: true, value: num }
  },

  // 验证缓停止时间值
  validateSoftStopTime(value) {
    const num = parseInt(value)
    if (isNaN(num)) {
      return { valid: false, message: '请输入有效的数字' }
    }
    if (num < 0 || num > 1000) { // 假设最大1000个0.1秒单位，即100秒
      return { valid: false, message: '缓停止时间应在0-1000单位之间' }
    }
    return { valid: true, value: num }
  },

  // 频率增加按钮
  onFrequencyIncrease() {
    const newValue = this.data.frequency + 1 // 增加1kHz步长
    const validation = this.validateFrequency(newValue)
    if (validation.valid) {
      this.setData({ frequency: validation.value })
    }
  },

  // 频率减少按钮
  onFrequencyDecrease() {
    const newValue = this.data.frequency - 1 // 减少1kHz步长
    const validation = this.validateFrequency(newValue)
    if (validation.valid) {
      this.setData({ frequency: validation.value })
    }
  },

  // 频率输入框变化
  onFrequencyInput(e) {
    const validation = this.validateFrequency(e.detail.value)
    if (validation.valid) {
      this.setData({ frequency: validation.value })
    }
  },

  // 频率输入框失焦验证
  onFrequencyBlur(e) {
    const validation = this.validateFrequency(e.detail.value)
    if (validation.valid) {
      this.setData({ frequency: validation.value })
    } else {
      wx.showToast({
        title: validation.message,
        icon: 'none'
      })
    }
  },

  // 占空比增加按钮
  onDutyCycleIncrease() {
    const newValue = this.data.dutyCycle + 1 // 增加1%步长
    const validation = this.validateDutyCycle(newValue)
    if (validation.valid) {
      this.setData({ dutyCycle: validation.value })
    }
  },

  // 占空比减少按钮
  onDutyCycleDecrease() {
    const newValue = this.data.dutyCycle - 1 // 减少1%步长
    const validation = this.validateDutyCycle(newValue)
    if (validation.valid) {
      this.setData({ dutyCycle: validation.value })
    }
  },

  // 占空比输入框变化
  onDutyCycleInput(e) {
    const validation = this.validateDutyCycle(e.detail.value)
    if (validation.valid) {
      this.setData({ dutyCycle: validation.value })
    }
  },

  // 占空比输入框失焦验证
  onDutyCycleBlur(e) {
    const validation = this.validateDutyCycle(e.detail.value)
    if (validation.valid) {
      this.setData({ dutyCycle: validation.value })
    } else {
      wx.showToast({
        title: validation.message,
        icon: 'none'
      })
    }
  },

  // 最小输出增加按钮
  onMinOutputIncrease() {
    const newValue = this.data.minOutput + 1
    const validation = this.validateMinOutput(newValue)
    if (validation.valid) {
      this.setData({ minOutput: validation.value })
    }
  },

  // 最小输出减少按钮
  onMinOutputDecrease() {
    const newValue = this.data.minOutput - 1
    const validation = this.validateMinOutput(newValue)
    if (validation.valid) {
      this.setData({ minOutput: validation.value })
    }
  },

  // 最小输出输入框变化
  onMinOutputInput(e) {
    const validation = this.validateMinOutput(e.detail.value)
    if (validation.valid) {
      this.setData({ minOutput: validation.value })
    }
  },

  // 最小输出输入框失焦验证
  onMinOutputBlur(e) {
    const validation = this.validateMinOutput(e.detail.value)
    if (validation.valid) {
      this.setData({ minOutput: validation.value })
    } else {
      wx.showToast({
        title: validation.message,
        icon: 'none'
      })
    }
  },

  // 最大输出增加按钮
  onMaxOutputIncrease() {
    const newValue = this.data.maxOutput + 1
    const validation = this.validateMaxOutput(newValue)
    if (validation.valid) {
      this.setData({ maxOutput: validation.value })
    }
  },

  // 最大输出减少按钮
  onMaxOutputDecrease() {
    const newValue = this.data.maxOutput - 1
    const validation = this.validateMaxOutput(newValue)
    if (validation.valid) {
      this.setData({ maxOutput: validation.value })
    }
  },

  // 最大输出输入框变化
  onMaxOutputInput(e) {
    const validation = this.validateMaxOutput(e.detail.value)
    if (validation.valid) {
      this.setData({ maxOutput: validation.value })
    }
  },

  // 最大输出输入框失焦验证
  onMaxOutputBlur(e) {
    const validation = this.validateMaxOutput(e.detail.value)
    if (validation.valid) {
      this.setData({ maxOutput: validation.value })
    } else {
      wx.showToast({
        title: validation.message,
        icon: 'none'
      })
    }
  },

  // 缓启动时间增加按钮
  onSoftStartTimeIncrease() {
    const newValue = this.data.softStartTime + 1 // 增加1个单位(1秒)
    const validation = this.validateSoftStartTime(newValue)
    if (validation.valid) {
      this.setData({ softStartTime: validation.value })
    }
  },

  // 缓启动时间减少按钮
  onSoftStartTimeDecrease() {
    const newValue = this.data.softStartTime - 1 // 减少1个单位(1秒)
    const validation = this.validateSoftStartTime(newValue)
    if (validation.valid) {
      this.setData({ softStartTime: validation.value })
    }
  },

  // 缓启动时间输入框变化
  onSoftStartTimeInput(e) {
    const validation = this.validateSoftStartTime(e.detail.value)
    if (validation.valid) {
      this.setData({ softStartTime: validation.value })
    }
  },

  // 缓启动时间输入框失焦验证
  onSoftStartTimeBlur(e) {
    const validation = this.validateSoftStartTime(e.detail.value)
    if (validation.valid) {
      this.setData({ softStartTime: validation.value })
    } else {
      wx.showToast({
        title: validation.message,
        icon: 'none'
      })
    }
  },

  // 缓停止时间增加按钮
  onSoftStopTimeIncrease() {
    const newValue = this.data.softStopTime + 1 // 增加1个单位(1秒)
    const validation = this.validateSoftStopTime(newValue)
    if (validation.valid) {
      this.setData({ softStopTime: validation.value })
    }
  },

  // 缓停止时间减少按钮
  onSoftStopTimeDecrease() {
    const newValue = this.data.softStopTime - 1 // 减少1个单位(1秒)
    const validation = this.validateSoftStopTime(newValue)
    if (validation.valid) {
      this.setData({ softStopTime: validation.value })
    }
  },

  // 缓停止时间输入框变化
  onSoftStopTimeInput(e) {
    const validation = this.validateSoftStopTime(e.detail.value)
    if (validation.valid) {
      this.setData({ softStopTime: validation.value })
    }
  },

  // 缓停止时间输入框失焦验证
  onSoftStopTimeBlur(e) {
    const validation = this.validateSoftStopTime(e.detail.value)
    if (validation.valid) {
      this.setData({ softStopTime: validation.value })
    } else {
      wx.showToast({
        title: validation.message,
        icon: 'none'
      })
    }
  },

  // 外接开关变化
  onExternalSwitchChange(e) {
    this.setData({ externalSwitch: e.detail.value })
  },

  // 0-10V控制开关变化
  onAnalogControlChange(e) {
    this.setData({ analogControl: e.detail.value })
  },

  // 开机默认状态开关变化
  onPowerOnStateChange(e) {
    this.setData({ powerOnState: e.detail.value })
  },

  // 应用调速器设置到BLE设备
  async onApplySpeedSettings() {
    if (this.data.connectionStatus !== 'connected' || !this.data.deviceId) {
      this.showErrorToast('请先连接设备')
      return
    }

    this.setData({ isSpeedApplying: true })

    try {
      // 调用BLE函数来设置调速器参数
      await Ble.setSpeedControllerParams(this.data.deviceId, {
        frequency: this.data.frequency,
        dutyCycle: this.data.dutyCycle,
        minOutput: this.data.minOutput,
        maxOutput: this.data.maxOutput,
        softStartTime: this.data.softStartTime,
        softStopTime: this.data.softStopTime,
        externalSwitch: this.data.externalSwitch,
        analogControl: this.data.analogControl,
        powerOnState: this.data.powerOnState
      })

      this.showSuccessToast('调速器设置已应用')
    } catch (error) {
      console.error('应用调速器设置失败:', error)
      let errorMessage = '设置失败，请重试'

      if (error.errCode === 10004) {
        errorMessage = '设备通信失败'
      } else if (error.errCode === 10006) {
        errorMessage = '设备连接已断开'
      } else if (error.message) {
        errorMessage = error.message
      }

      this.showErrorToast(errorMessage)
    } finally {
      this.setData({ isSpeedApplying: false })
    }
  },

  // 从BLE设备同步调速器参数
  async syncSpeedControllerParams() {
    if (this.data.connectionStatus !== 'connected' || !this.data.deviceId) {
      return
    }

    try {
      // 获取调速器状态
      const speedControllerStatus = await Ble.getSpeedControllerStatus(this.data.deviceId)
      
      // 更新UI控件
      this.setData({
        frequency: speedControllerStatus.frequency,
        dutyCycle: speedControllerStatus.dutyCycle,
        minOutput: speedControllerStatus.minOutput,
        maxOutput: speedControllerStatus.maxOutput,
        softStartTime: speedControllerStatus.softStartTime,
        softStopTime: speedControllerStatus.softStopTime,
        externalSwitch: speedControllerStatus.externalSwitch,
        analogControl: speedControllerStatus.analogControl,
        powerOnState: speedControllerStatus.powerOnState
      })
      
      console.log('已同步调速器参数:', speedControllerStatus)
    } catch (error) {
      console.error('同步调速器参数失败:', error)
      
      // 根据错误类型处理
      let errorMessage = '获取调速器参数失败'
      
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
  }
})
