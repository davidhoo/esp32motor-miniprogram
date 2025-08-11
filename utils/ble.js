// ESP32-Motor BLE连接工具
// 简化版本，只包含设备发现和连接功能

// BLE服务定义
const SERVICE_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'

// 特征值UUID定义
const CHARACTERISTIC_UUIDS = {
  RUN_DURATION: '2f7a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c6',    // 运行时长
  STOP_INTERVAL: '3f8a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c7',   // 停止间隔
  SYSTEM_CONTROL: '4f9a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c8',  // 系统控制
  STATUS_QUERY: '5f9a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c9'     // 状态查询
}

// 设备名称
const DEVICE_NAME = 'ESP32-Motor-Control'

// 基础工具函数

/**
 * 将ArrayBuffer转换为十六进制字符串
 * @param {ArrayBuffer} buffer - 要转换的ArrayBuffer
 * @returns {string} - 十六进制字符串
 */
function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 将ArrayBuffer转换为UTF-8字符串（微信小程序兼容版本）
 * @param {ArrayBuffer} buffer - 要转换的ArrayBuffer
 * @returns {string} - UTF-8字符串
 */
function bufferToString(buffer) {
  // 检查buffer是否有效
  if (!buffer) {
    console.warn('bufferToString: buffer为空')
    return ''
  }
  
  const bytes = new Uint8Array(buffer)
  let result = ''
  
  // 使用微信小程序兼容的方式转换UTF-8
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]
    
    if (byte < 0x80) {
      // ASCII字符
      result += String.fromCharCode(byte)
    } else if (byte < 0xE0) {
      // 2字节UTF-8字符
      if (i + 1 < bytes.length) {
        const byte2 = bytes[i + 1]
        const codePoint = ((byte & 0x1F) << 6) | (byte2 & 0x3F)
        result += String.fromCharCode(codePoint)
        i++
      }
    } else if (byte < 0xF0) {
      // 3字节UTF-8字符
      if (i + 2 < bytes.length) {
        const byte2 = bytes[i + 1]
        const byte3 = bytes[i + 2]
        const codePoint = ((byte & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F)
        result += String.fromCharCode(codePoint)
        i += 2
      }
    } else {
      // 4字节UTF-8字符（使用代理对）
      if (i + 3 < bytes.length) {
        const byte2 = bytes[i + 1]
        const byte3 = bytes[i + 2]
        const byte4 = bytes[i + 3]
        let codePoint = ((byte & 0x07) << 18) | ((byte2 & 0x3F) << 12) | ((byte3 & 0x3F) << 6) | (byte4 & 0x3F)
        
        // 转换为代理对
        codePoint -= 0x10000
        const high = 0xD800 + (codePoint >> 10)
        const low = 0xDC00 + (codePoint & 0x3FF)
        result += String.fromCharCode(high, low)
        i += 3
      }
    }
  }
  
  return result
}

/**
 * 将数字转换为ArrayBuffer（小端格式）
 * @param {number} value - 要转换的数字
 * @param {number} bytes - 字节数（1, 2, 4）
 * @returns {ArrayBuffer} - 转换后的ArrayBuffer
 */
function numberToBuffer(value, bytes = 4) {
  const buffer = new ArrayBuffer(bytes)
  const view = new DataView(buffer)
  
  switch (bytes) {
    case 1:
      view.setUint8(0, value)
      break
    case 2:
      view.setUint16(0, value, true) // 小端格式
      break
    case 4:
      view.setUint32(0, value, true) // 小端格式
      break
    default:
      throw new Error('不支持的位数')
  }
  
  return buffer
}

// BLE通信API封装

/**
 * 扫描ESP32-Motor设备
 * @returns {Promise<Array>} - 返回设备列表
 */
function scanDevices() {
  return new Promise((resolve, reject) => {
    wx.openBluetoothAdapter({
      success: () => {
        wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: false,
          success: () => {
            setTimeout(() => {
              wx.getBluetoothDevices({
                success: (res) => {
                  const devices = res.devices.filter(device => 
                    device.name === DEVICE_NAME || 
                    device.localName === DEVICE_NAME
                  )
                  console.log('扫描到设备:', devices.length, '个')
                  resolve(devices)
                },
                fail: reject
              })
            }, 2000) // 增加扫描时间到2秒
          },
          fail: reject
        })
      },
      fail: reject
    })
  })
}

/**
 * 连接BLE设备
 * @param {string} deviceId - 设备ID
 * @returns {Promise} - 连接结果
 */
function connectDevice(deviceId) {
  return new Promise((resolve, reject) => {
    console.log('开始连接设备:', deviceId)
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        console.log('设备连接成功:', deviceId)
        resolve(res)
      },
      fail: (error) => {
        console.error('连接设备失败:', {
          deviceId,
          errorCode: error.errCode,
          errorMessage: error.errMsg
        })
        reject(error)
      }
    })
  })
}

/**
 * 断开BLE设备连接
 * @param {string} deviceId - 设备ID
 * @returns {Promise} - 断开结果
 */
function disconnectDevice(deviceId) {
  return new Promise((resolve, reject) => {
    console.log('断开设备连接:', deviceId)
    wx.closeBLEConnection({
      deviceId,
      success: (res) => {
        console.log('设备断开成功:', deviceId)
        resolve(res)
      },
      fail: (error) => {
        console.error('断开设备失败:', error)
        reject(error)
      }
    })
  })
}

/**
 * 获取设备服务
 * @param {string} deviceId - 设备ID
 * @returns {Promise} - 服务列表
 */
function getServices(deviceId) {
  return new Promise((resolve, reject) => {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        console.log('获取服务成功:', res.services.length, '个服务')
        resolve(res)
      },
      fail: (error) => {
        console.error('获取服务失败:', {
          deviceId,
          errorCode: error.errCode,
          errorMessage: error.errMsg
        })
        reject(error)
      }
    })
  })
}

/**
 * 获取设备特征值
 * @param {string} deviceId - 设备ID
 * @param {string} serviceId - 服务UUID
 * @returns {Promise} - 特征值列表
 */
function getCharacteristics(deviceId, serviceId) {
  return new Promise((resolve, reject) => {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('获取特征值成功:', res.characteristics.length, '个特征值')
        resolve(res)
      },
      fail: (error) => {
        console.error('获取特征值失败:', {
          deviceId,
          serviceId,
          errorCode: error.errCode,
          errorMessage: error.errMsg
        })
        reject(error)
      }
    })
  })
}

/**
 * 验证设备连接状态
 * @param {string} deviceId - 设备ID
 * @returns {Promise<boolean>} - 连接状态
 */
function verifyConnection(deviceId) {
  return new Promise((resolve) => {
    wx.getBLEDeviceServices({
      deviceId,
      success: () => {
        console.log('✅ 设备连接验证成功:', deviceId)
        resolve(true)
      },
      fail: (error) => {
        console.warn('⚠️ 设备连接验证失败:', {
          deviceId,
          errorCode: error.errCode,
          errorMessage: error.errMsg
        })
        resolve(false)
      }
    })
  })
}

/**
 * 带重试机制的设备连接
 * @param {string} deviceId - 设备ID
 * @param {number} maxRetries - 最大重试次数
 * @param {number} retryDelay - 重试延迟(毫秒)
 * @returns {Promise} - 连接结果
 */
async function connectDeviceWithRetry(deviceId, maxRetries = 3, retryDelay = 1000) {
  let lastError = null
  
  console.log(`开始带重试的设备连接 (最多${maxRetries}次):`, deviceId)
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`尝试连接设备 (${attempt}/${maxRetries}):`, deviceId)
      await connectDevice(deviceId)
      
      // 连接成功后等待一段时间确保连接稳定
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 验证连接状态
      const isConnected = await verifyConnection(deviceId)
      if (isConnected) {
        console.log('✅ 设备连接并验证成功:', deviceId)
        return
      } else {
        throw new Error('连接验证失败')
      }
    } catch (error) {
      lastError = error
      console.warn(`连接尝试 ${attempt} 失败:`, {
        attempt,
        errorCode: error.errCode,
        errorMessage: error.errMsg || error.message
      })
      
      if (attempt < maxRetries) {
        const currentDelay = retryDelay * attempt // 递增延迟
        console.log(`等待 ${currentDelay}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, currentDelay))
      }
    }
  }
  
  console.error('❌ 所有连接尝试失败:', lastError)
  throw lastError
}

/**
 * 读取BLE特征值（使用事件监听方式）
 * @param {string} deviceId - 设备ID
 * @param {string} serviceId - 服务UUID
 * @param {string} characteristicId - 特征值UUID
 * @returns {Promise<ArrayBuffer>} - 特征值数据
 */
function readCharacteristic(deviceId, serviceId, characteristicId) {
  return new Promise((resolve, reject) => {
    let isResolved = false
    
    // 设置超时
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true
        console.error('读取特征值超时:', characteristicId)
        reject(new Error('读取特征值超时'))
      }
    }, 5000) // 5秒超时
    
    // 监听特征值变化
    const onCharacteristicValueChange = (res) => {
      console.log('接收到特征值变化事件:', res)
      
      if (res.deviceId === deviceId &&
          res.serviceId.toUpperCase() === serviceId.toUpperCase() &&
          res.characteristicId.toUpperCase() === characteristicId.toUpperCase()) {
        
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          
          console.log('读取特征值成功:', characteristicId)
          console.log('返回的数据:', res)
          console.log('res.value类型:', typeof res.value)
          console.log('res.value:', res.value)
          
          // 移除事件监听
          wx.offBLECharacteristicValueChange(onCharacteristicValueChange)
          
          resolve(res.value)
        }
      }
    }
    
    // 注册事件监听
    wx.onBLECharacteristicValueChange(onCharacteristicValueChange)
    
    // 发起读取请求
    wx.readBLECharacteristicValue({
      deviceId,
      serviceId,
      characteristicId,
      success: (res) => {
        console.log('读取特征值请求发送成功:', characteristicId)
        console.log('请求返回:', res)
        // 注意：这里不直接resolve，等待事件回调
      },
      fail: (error) => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          wx.offBLECharacteristicValueChange(onCharacteristicValueChange)
          
          console.error('读取特征值请求失败:', {
            deviceId,
            serviceId,
            characteristicId,
            errorCode: error.errCode,
            errorMessage: error.errMsg
          })
          reject(error)
        }
      }
    })
  })
}

/**
 * 写入BLE特征值
 * @param {string} deviceId - 设备ID
 * @param {string} serviceId - 服务UUID
 * @param {string} characteristicId - 特征值UUID
 * @param {ArrayBuffer} buffer - 要写入的数据
 * @returns {Promise} - 写入结果
 */
function writeCharacteristic(deviceId, serviceId, characteristicId, buffer) {
  return new Promise((resolve, reject) => {
    console.log('开始写入特征值:', {
      deviceId,
      serviceId,
      characteristicId,
      buffer: bufferToHex(buffer)
    })
    
    wx.writeBLECharacteristicValue({
      deviceId,
      serviceId,
      characteristicId,
      value: buffer,
      success: (res) => {
        console.log('写入特征值成功:', characteristicId)
        resolve(res)
      },
      fail: (error) => {
        console.error('写入特征值失败:', {
          deviceId,
          serviceId,
          characteristicId,
          errorCode: error.errCode,
          errorMessage: error.errMsg
        })
        reject(error)
      }
    })
  })
}

/**
 * 获取目标服务和特征值
 * @param {string} deviceId - 设备ID
 * @param {string} targetCharacteristicUUID - 目标特征值UUID
 * @returns {Promise<Object>} - 包含serviceId和characteristicId的对象
 */
async function getTargetServiceAndCharacteristic(deviceId, targetCharacteristicUUID) {
  try {
    // 获取服务列表
    const servicesRes = await getServices(deviceId)
    console.log('设备服务列表:', servicesRes.services.map(s => s.uuid))
    
    // 查找目标服务
    let targetService = null
    for (const service of servicesRes.services) {
      if (service.uuid.toLowerCase() === SERVICE_UUID.toLowerCase()) {
        targetService = service
        break
      }
    }
    
    if (!targetService) {
      throw new Error('未找到目标服务')
    }
    
    console.log('找到目标服务:', targetService.uuid)
    
    // 获取特征值信息
    const characteristicsRes = await getCharacteristics(deviceId, targetService.uuid)
    console.log('服务特征值列表:', characteristicsRes.characteristics.map(c => ({
      uuid: c.uuid,
      properties: c.properties
    })))
    
    // 查找目标特征值
    let targetCharacteristic = null
    for (const char of characteristicsRes.characteristics) {
      if (char.uuid.toLowerCase() === targetCharacteristicUUID.toLowerCase()) {
        targetCharacteristic = char
        break
      }
    }
    
    if (!targetCharacteristic) {
      throw new Error('未找到目标特征值')
    }
    
    console.log('找到目标特征值:', targetCharacteristic.uuid, '属性:', targetCharacteristic.properties)
    
    return {
      serviceId: targetService.uuid,
      characteristicId: targetCharacteristic.uuid
    }
    
  } catch (error) {
    console.error('获取目标服务和特征值失败:', error)
    throw error
  }
}

/**
 * 设置运行时长
 * @param {string} deviceId - 设备ID
 * @param {number} duration - 运行时长（秒）
 * @returns {Promise} - 设置结果
 */
async function setRunDuration(deviceId, duration) {
  try {
    console.log('设置运行时长:', { deviceId, duration })
    
    // 获取目标服务和特征值
    const { serviceId, characteristicId } = await getTargetServiceAndCharacteristic(
      deviceId,
      CHARACTERISTIC_UUIDS.RUN_DURATION
    )
    
    // 将时长转换为4字节小端格式
    const buffer = numberToBuffer(duration, 4)
    
    // 写入特征值
    await writeCharacteristic(deviceId, serviceId, characteristicId, buffer)
    
    console.log('运行时长设置成功:', duration)
    return true
    
  } catch (error) {
    console.error('设置运行时长失败:', error)
    throw error
  }
}

/**
 * 设置停止间隔
 * @param {string} deviceId - 设备ID
 * @param {number} duration - 停止间隔（秒）
 * @returns {Promise} - 设置结果
 */
async function setStopDuration(deviceId, duration) {
  try {
    console.log('设置停止间隔:', { deviceId, duration })
    
    // 获取目标服务和特征值
    const { serviceId, characteristicId } = await getTargetServiceAndCharacteristic(
      deviceId,
      CHARACTERISTIC_UUIDS.STOP_INTERVAL
    )
    
    // 将时长转换为4字节小端格式
    const buffer = numberToBuffer(duration, 4)
    
    // 写入特征值
    await writeCharacteristic(deviceId, serviceId, characteristicId, buffer)
    
    console.log('停止间隔设置成功:', duration)
    return true
    
  } catch (error) {
    console.error('设置停止间隔失败:', error)
    throw error
  }
}

/**
 * 设置系统控制状态
 * @param {string} deviceId - 设备ID
 * @param {number} control - 控制状态（0=停止，1=启动）
 * @returns {Promise} - 设置结果
 */
async function setSystemControl(deviceId, control) {
  try {
    console.log('设置系统控制状态:', { deviceId, control })
    
    // 获取目标服务和特征值
    const { serviceId, characteristicId } = await getTargetServiceAndCharacteristic(
      deviceId,
      CHARACTERISTIC_UUIDS.SYSTEM_CONTROL
    )
    
    // 将控制状态转换为1字节
    const buffer = numberToBuffer(control, 1)
    
    // 写入特征值
    await writeCharacteristic(deviceId, serviceId, characteristicId, buffer)
    
    console.log('系统控制状态设置成功:', control)
    return true
    
  } catch (error) {
    console.error('设置系统控制状态失败:', error)
    throw error
  }
}

/**
 * 获取系统状态
 * @param {string} deviceId - 设备ID
 * @returns {Promise<Object>} - 系统状态对象
 */
async function getSystemStatus(deviceId) {
  try {
    console.log('开始获取系统状态:', deviceId)
    
    // 获取目标服务和特征值
    const { serviceId, characteristicId } = await getTargetServiceAndCharacteristic(
      deviceId,
      CHARACTERISTIC_UUIDS.STATUS_QUERY
    )
    
    // 读取状态查询特征值
    const buffer = await readCharacteristic(deviceId, serviceId, characteristicId)
    
    // 检查buffer是否有效
    if (!buffer) {
      console.warn('读取到的buffer为空，返回默认状态')
      return {
        state: 0,
        stateName: 'STOPPED',
        remainingRunTime: 0,
        remainingStopTime: 0,
        currentCycleCount: 0,
        runDuration: 30,
        stopDuration: 60,
        cycleCount: 0,
        autoStart: false,
        uptime: 0,
        freeHeap: 0
      }
    }
    
    // 将ArrayBuffer转换为字符串
    const jsonString = bufferToString(buffer)
    
    // 检查是否为空数据
    if (!jsonString || jsonString.trim().length === 0) {
      console.warn('接收到空的状态数据，返回默认状态')
      return {
        state: 0,
        stateName: 'STOPPED',
        remainingRunTime: 0,
        remainingStopTime: 0,
        currentCycleCount: 0,
        runDuration: 30,
        stopDuration: 60,
        cycleCount: 0,
        autoStart: false,
        uptime: 0,
        freeHeap: 0
      }
    }
    
    // 解析JSON数据
    let statusData
    try {
      statusData = JSON.parse(jsonString.trim())
    } catch (parseError) {
      console.error('JSON解析失败:', parseError)
      return {
        state: 0,
        stateName: 'STOPPED',
        remainingRunTime: 0,
        remainingStopTime: 0,
        currentCycleCount: 0,
        runDuration: 30,
        stopDuration: 60,
        cycleCount: 0,
        autoStart: false,
        uptime: 0,
        freeHeap: 0
      }
    }
    
    // 直接使用实际返回的字段结构
    const systemStatus = {
      state: statusData.state || 0,
      stateName: statusData.stateName || 'STOPPED',
      remainingRunTime: statusData.remainingRunTime || 0,
      remainingStopTime: statusData.remainingStopTime || 0,
      currentCycleCount: statusData.currentCycleCount || 0,
      runDuration: statusData.runDuration || 30,
      stopDuration: statusData.stopDuration || 60,
      cycleCount: statusData.cycleCount || 0,
      autoStart: statusData.autoStart || false,
      uptime: statusData.uptime || 0,
      freeHeap: statusData.freeHeap || 0
    }
    
    console.log('获取系统状态成功:', systemStatus)
    return systemStatus
    
  } catch (error) {
    console.error('获取系统状态失败:', error)
    throw error
  }
}

// 导出模块
export default {
  // 常量定义
  SERVICE_UUID,
  CHARACTERISTIC_UUIDS,
  DEVICE_NAME,

  // 工具函数
  bufferToHex,
  bufferToString,
  numberToBuffer,

  // BLE基础操作
  scanDevices,
  connectDevice,
  disconnectDevice,
  getServices,
  getCharacteristics,
  verifyConnection,
  readCharacteristic,
  writeCharacteristic,

  // 增强的连接函数
  connectDeviceWithRetry,
  
  // 状态查询功能
  getSystemStatus,
  
  // 控制功能
  setRunDuration,
  setStopDuration,
  setSystemControl
}
