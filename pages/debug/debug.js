import Ble from '../../utils/ble.js'

// 统一打印
function now() { return new Date().toLocaleTimeString('zh-CN'); }

Page({
  data: { 
    log: '',
    deviceId: '',
    connected: false
  },
  
  add(s) { 
    this.setData({ log: this.data.log + `[${now()}] ${s}\n` }); 
    console.log(`[DEBUG] ${s}`)
  },

  // 测试新的连接流程
  async handleConnect() {
    this.setData({ log: '' });
    this.add('🔄 开始测试新的BLE连接流程...');

    try {
      // 1. 扫描设备
      this.add('📡 开始扫描ESP32-Motor设备...');
      const devices = await this.step('扫描设备', () => Ble.scanDevices());
      
      if (devices.length === 0) {
        this.add('❌ 未找到设备，请确保ESP32-Motor设备已开启');
        return;
      }

      const device = devices[0];
      this.add(`✅ 找到设备: ${device.name || device.localName} (${device.deviceId})`);
      this.setData({ deviceId: device.deviceId });

      // 2. 使用新的重试连接机制
      this.add('🔗 使用重试机制连接设备...');
      await this.step('重试连接', () => Ble.connectDeviceWithRetry(device.deviceId, 3, 1000));
      this.add('✅ 设备连接成功');

      // 3. 设置设备服务
      this.add('⚙️ 设置设备服务和特征值...');
      const deviceInfo = await this.step('设备服务设置', () => Ble.setupDeviceServices(device.deviceId));
      
      this.add(`✅ 服务设置完成:`);
      this.add(`   服务UUID: ${deviceInfo.service.uuid}`);
      this.add(`   特征值数量: ${Object.keys(deviceInfo.characteristics).length}`);
      
      // 显示找到的特征值
      Object.entries(deviceInfo.characteristics).forEach(([uuid, char]) => {
        const props = Object.keys(char.properties).filter(key => char.properties[key]).join(', ');
        this.add(`   特征值: ${uuid} (${props})`);
      });

      // 4. 测试状态读取
      this.add('📊 测试状态读取...');
      try {
        const status = await this.step('读取系统状态', () => Ble.getSystemStatus(device.deviceId));
        this.add(`✅ 状态读取成功: ${JSON.stringify(status)}`);
      } catch (error) {
        this.add(`⚠️ 状态读取失败: ${error.message || error.errMsg}`);
        this.add(`   错误详情: ${JSON.stringify(error)}`);
      }

      // 4.5. 测试连接验证
      this.add('🔍 测试连接验证...');
      try {
        const isConnected = await this.step('验证连接状态', () => Ble.verifyConnection(device.deviceId));
        this.add(`✅ 连接验证结果: ${isConnected ? '已连接' : '未连接'}`);
      } catch (error) {
        this.add(`⚠️ 连接验证失败: ${error.message || error.errMsg}`);
      }

      // 4.6. 测试重试机制
      this.add('🔄 测试重试读取机制...');
      try {
        const result = await this.step('重试读取特征值', () =>
          Ble.readCharacteristicWithRetry(device.deviceId, Ble.CHAR_SYSTEM_STATUS, 2, 300)
        );
        this.add(`✅ 重试读取成功，数据长度: ${result.value ? result.value.byteLength : 0} 字节`);
      } catch (error) {
        this.add(`⚠️ 重试读取失败: ${error.message || error.errMsg}`);
      }

      // 5. 测试通知订阅（使用新的重试机制）
      if (deviceInfo.characteristics[Ble.CHAR_SYSTEM_STATUS]) {
        const statusChar = deviceInfo.characteristics[Ble.CHAR_SYSTEM_STATUS];
        if (statusChar.properties.notify || statusChar.properties.indicate) {
          this.add('🔔 测试通知订阅（带重试机制）...');
          try {
            await this.step('订阅状态通知', () =>
              Ble.notifyCharacteristicWithRetry(device.deviceId, Ble.CHAR_SYSTEM_STATUS, 2, 500)
            );
            this.add('✅ 通知订阅成功');
            
            // 测试通知监听
            this.add('📡 设置通知监听器...');
            wx.onBLECharacteristicValueChange((res) => {
              if (res.deviceId === device.deviceId && res.characteristicId === Ble.CHAR_SYSTEM_STATUS) {
                try {
                  const status = Ble.bufferToJson(res.value);
                  this.add(`📊 收到状态通知: ${JSON.stringify(status)}`);
                } catch (e) {
                  this.add(`⚠️ 解析通知数据失败: ${e.message}`);
                }
              }
            });
            
          } catch (error) {
            this.add(`⚠️ 通知订阅失败: ${error.errMsg || error.message}`);
            if (error.message && error.message.includes('不支持通知')) {
              this.add('ℹ️ 特征值不支持通知，将使用轮询模式');
            }
          }
        } else {
          this.add('ℹ️ 状态特征值不支持通知，将使用轮询模式');
        }
      }

      this.setData({ connected: true });
      this.add('🎉 所有测试完成！连接流程正常工作');

    } catch (error) {
      this.add(`❌ 连接测试失败: ${error.errMsg || error.message}`);
      this.add(`   错误代码: ${error.errCode || 'N/A'}`);
      console.error('连接测试失败:', error);
    }
  },

  // 测试断开连接
  async handleDisconnect() {
    if (!this.data.deviceId) {
      this.add('❌ 没有已连接的设备');
      return;
    }

    try {
      this.add('🔌 断开设备连接...');
      await this.step('断开连接', () => Ble.disconnectDevice(this.data.deviceId));
      this.setData({ connected: false, deviceId: '' });
      this.add('✅ 设备已断开连接');
    } catch (error) {
      this.add(`❌ 断开连接失败: ${error.errMsg || error.message}`);
    }
  },

  // 测试状态读取
  async handleTestStatus() {
    if (!this.data.deviceId || !this.data.connected) {
      this.add('❌ 请先连接设备');
      return;
    }

    this.add('🧪 开始测试状态读取功能...');
    
    try {
      // 测试普通读取
      this.add('📖 测试普通状态读取...');
      const status1 = await this.step('普通读取', () => Ble.getSystemStatus(this.data.deviceId));
      this.add(`✅ 普通读取成功: ${JSON.stringify(status1)}`);

      // 测试重试读取
      this.add('🔄 测试重试读取...');
      const status2 = await this.step('重试读取', () =>
        Ble.readCharacteristicWithRetry(this.data.deviceId, Ble.CHAR_SYSTEM_STATUS, 3, 500)
      );
      this.add(`✅ 重试读取成功，数据: ${Ble.bufferToHex(status2.value)}`);

      // 测试连接验证
      this.add('🔍 测试连接验证...');
      const isConnected = await this.step('连接验证', () => Ble.verifyConnection(this.data.deviceId));
      this.add(`✅ 连接状态: ${isConnected ? '正常' : '异常'}`);

    } catch (error) {
      this.add(`❌ 状态测试失败: ${error.message || error.errMsg}`);
    }
  },

  // 测试通知订阅
  async handleTestNotify() {
    if (!this.data.deviceId || !this.data.connected) {
      this.add('❌ 请先连接设备');
      return;
    }

    this.add('🔔 开始测试通知订阅功能...');
    
    try {
      // 1. 检查通知支持
      this.add('🔍 检查特征值通知支持...');
      const supportNotify = await this.step('检查通知支持', () =>
        Ble.checkNotifySupport(this.data.deviceId, Ble.CHAR_SYSTEM_STATUS)
      );
      
      if (!supportNotify) {
        this.add('⚠️ 特征值不支持通知，将使用轮询模式');
        return;
      }
      
      this.add('✅ 特征值支持通知');

      // 2. 测试普通通知订阅
      this.add('📡 测试普通通知订阅...');
      try {
        await this.step('普通订阅', () => Ble.notifyCharacteristic(this.data.deviceId, Ble.CHAR_SYSTEM_STATUS));
        this.add('✅ 普通订阅成功');
      } catch (error) {
        this.add(`⚠️ 普通订阅失败: ${error.errMsg || error.message}`);
      }

      // 3. 测试带重试的通知订阅
      this.add('🔄 测试带重试的通知订阅...');
      try {
        await this.step('重试订阅', () =>
          Ble.notifyCharacteristicWithRetry(this.data.deviceId, Ble.CHAR_SYSTEM_STATUS, 3, 500)
        );
        this.add('✅ 重试订阅成功');
        
        // 设置通知监听
        this.add('📡 设置通知监听器...');
        wx.onBLECharacteristicValueChange((res) => {
          if (res.deviceId === this.data.deviceId && res.characteristicId === Ble.CHAR_SYSTEM_STATUS) {
            try {
              const status = Ble.bufferToJson(res.value);
              this.add(`📊 收到状态通知: ${JSON.stringify(status)}`);
            } catch (e) {
              this.add(`⚠️ 解析通知数据失败: ${e.message}`);
            }
          }
        });
        
      } catch (error) {
        this.add(`❌ 重试订阅失败: ${error.errMsg || error.message}`);
        if (error.message && error.message.includes('不支持通知')) {
          this.add('ℹ️ 特征值不支持通知，建议使用轮询模式');
        }
      }

      // 4. 测试取消订阅
      this.add('🔕 测试取消订阅...');
      try {
        await this.step('取消订阅', () => Ble.unnotifyCharacteristic(this.data.deviceId, Ble.CHAR_SYSTEM_STATUS));
        this.add('✅ 取消订阅成功');
      } catch (error) {
        this.add(`⚠️ 取消订阅失败: ${error.errMsg || error.message}`);
      }

    } catch (error) {
      this.add(`❌ 通知测试失败: ${error.message || error.errMsg}`);
    }
  },

  // 清空日志
  handleClear() {
    this.setData({ log: '' });
  },

  // 通用步骤执行器
  async step(name, fn) {
    try {
      this.add(`⏳ 执行: ${name}...`);
      const res = await fn();
      this.add(`✅ ${name} 成功`);
      return res;
    } catch (e) {
      this.add(`❌ ${name} 失败: ${e.errMsg || e.message}`);
      if (e.errCode) {
        this.add(`   错误代码: ${e.errCode}`);
      }
      throw e;
    }
  }
});
