# ESP32-Motor 微信小程序需求文档

## 1. 项目概述

基于BLE通信协议，开发一个用于控制ESP32电机设备的微信小程序。该应用将通过蓝牙低功耗(BLE)技术与ESP32设备通信，实现电机的智能控制与状态监控。

## 2. 功能需求

### 2.1 整体架构
应用主界面分为三个核心区域：
- **蓝牙连接管理区** (顶部)
- **电机控制区** (中部)
- **系统状态展示区** (底部)

### 2.2 蓝牙连接管理区

#### 2.2.1 功能要求
- **设备扫描与连接**
  - 自动扫描名称为"ESP32-Motor-Control"的BLE设备
  - 支持手动刷新扫描
  - 显示附近可用设备列表
  
- **连接状态管理**
  - 实时显示连接状态：未连接/连接中/已连接/连接失败
  - 提供连接/断开按钮
  - 连接失败后自动重试机制

#### 2.2.2 界面设计
```
┌─────────────────────────────────────┐
│ 📡 蓝牙连接                          │
│ ┌─────────────────────────────────┐ │
│ │ 设备: ESP32-Motor               │ │
│ │ [连接设备] [断开连接]           │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2.3 电机控制区

#### 2.3.1 功能要求
- **运行时长控制**
  - 范围：1-999秒
  - 滑块控制：实时预览数值
  - 输入框：允许直接输入精确数值
  - 默认值：30秒

- **停止间隔控制**
  - 范围：0-999秒
  - 滑块控制：实时预览数值
  - 输入框：允许直接输入精确数值
  - 默认值：60秒

- **系统控制**（已删除）
  - 系统开关控制功能已从UI中移除
  - 电机控制将通过运行时长和停止间隔参数自动管理

#### 2.3.2 界面设计
```
┌─────────────────────────────────────┐
│ ⚙️ 电机控制                          │
│ ┌─────────────────────────────────┐ │
│ │ 运行时长: [────●────] 30秒      │ │
│ │           [____30____]          │ │
│ │                                 │ │
│ │ 停止间隔: [────●────] 60秒      │ │
│ │           [____60____]          │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2.4 系统状态展示区

#### 2.4.1 功能要求
- **实时状态显示**
  - 电机状态：显示状态名称(STOPPED/RUNNING/PAUSED/STARTING)和状态码
  - 当前运行时长设置值：runDuration
  - 当前停止间隔设置值：stopDuration
  - 运行倒计时：remainingRunTime(剩余运行时间)
  - 停止倒计时：remainingStopTime(剩余停止时间)
  - 当前循环计数：currentCycleCount
  - 总循环计数设置：cycleCount
  - 自动启动状态：autoStart标志
  - 系统运行时间：uptime(设备总运行时长)
  - 系统内存状态：freeHeap(空闲堆内存)
  - 芯片温度：chipTemperature(设备温度监控)

- **调速器状态显示**
  - **调速器状态显示**
    - 调速器运行状态：isRunning(运行/停止)
    - 当前频率：frequency(Hz)
    - 当前占空比：dutyCycle(百分比)
    - 外接开关功能：externalSwitch(开启/关闭)
    - 0-10V控制功能：analogControl(开启/关闭)
    - 开机默认状态：powerOnState(运行/停止)
    - 最小输出百分比：minOutput(0-50%)
    - 最大输出百分比：maxOutput(60-100%)
    - 缓启动时间：softStartTime(0.1秒单位)
    - 缓停止时间：softStopTime(0.1秒单位)
    - 通信状态：connectionStatus(连接状态)
    - 响应时间：responseTime(毫秒)
    - 错误计数：errorCount(通信错误次数)
- **数据刷新机制**
  - 自动刷新：每1秒更新一次
  - 手动刷新：下拉刷新功能
  - 断线重连：自动恢复数据同步
#### 2.4.2 界面设计
```
┌─────────────────────────────────────┐
│ 📊 系统状态                          │
│ ┌─────────────────────────────────┐ │
│ │ 电机状态: STARTING(3) 🟡         │ │
│ │ 运行时长: 5秒                   │ │
│ │ 停止间隔: 2秒                   │ │
│ │ 运行倒计时: 0秒                 │ │
│ │ 停止倒计时: 0秒                 │ │
│ │ 当前循环: 1376次                │ │
│ │ 总循环设置: 0次                 │ │
│ │ 自动启动: 开启                  │ │
│ │ 运行时间: 1551:48:45            │ │
│ │ 空闲内存: 234KB                 │ │
│ │ 芯片温度: 45°C                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 🎛️ 调速器状态                        │
│ ┌─────────────────────────────────┐ │
│ │ 运行状态: 运行中 🟢             │ │
│ │ 当前频率: 1500Hz                │ │
│ │ 占空比: 80%                     │ │
│ │ 外接开关: 关闭                  │ │
│ │ 0-10V控制: 关闭                 │ │
│ │ 开机默认: 停止                  │ │
│ │ 最小输出: 10%                   │ │
│ │ 最大输出: 90%                   │ │
│ │ 缓启动时间: 5.0秒               │ │
│ │ 缓停止时间: 3.0秒               │ │
│ │ 通信状态: 已连接                │ │
│ │ 响应时间: 12ms                  │ │
│ │ 错误计数: 0次                   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 3.1 BLE通信协议
基于《ESP32-Motor BLE通信协议规范》实现：

#### 3.1.2 服务与特征值映射
| 功能 | UUID | 数据类型 | 权限 | 微信小程序映射 |
|------|------|----------|------|----------------|
| 运行时长 | `2f7a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c6` | 字符串 | R/W/N | runDuration |
| 停止间隔 | `3f8a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c7` | 字符串 | R/W/N | stopInterval |
| ~~系统控制~~ | ~~`4f9a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c8`~~ | ~~字符串~~ | ~~R/W/N~~ | ~~systemControl~~ |
| 状态查询 | `5f9a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c9` | JSON | R/N | systemStatus |
| 调速器状态 | `6f9a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5ca` | JSON | R/N | speedControllerStatus |
#### 3.1.3 数据格式转换

**基本数据类型**：
- **字符串格式**: UTF-8编码，用于运行时长、停止间隔参数
- **JSON格式**: UTF-8编码字符串，用于状态信息

**系统状态信息格式**：
```json
{
  "state": 3,
  "stateName": "STARTING",
  "remainingRunTime": 0,
  "remainingStopTime": 0,
  "currentCycleCount": 1376,
  "runDuration": 5,
  "stopDuration": 2,
  "cycleCount": 0,
  "autoStart": true,
  "uptime": 5585325,
  "freeHeap": 240060,
  "chipTemperature": 45
}
```

**系统状态字段说明**：
- `state`: 系统状态码 (0=停止, 1=运行中, 2=暂停, 3=启动中)
- `stateName`: 状态名称 ("STOPPED", "RUNNING", "PAUSED", "STARTING")
- `remainingRunTime`: 剩余运行时间(秒)
- `remainingStopTime`: 剩余停止时间(秒)
- `currentCycleCount`: 当前循环计数
- `runDuration`: 运行持续时间设置(秒)
- `stopDuration`: 停止持续时间设置(秒)
- `cycleCount`: 总循环计数设置
- `autoStart`: 自动启动标志
- `uptime`: 系统运行时间(毫秒)
- `freeHeap`: 空闲堆内存(字节)
- `chipTemperature`: 芯片温度(摄氏度)

**调速器状态信息格式**：
```json
{
  "moduleAddress": 1,
  "isRunning": true,
  "frequency": 1500,
  "dutyCycle": 80,
  "externalSwitch": false,
  "analogControl": false,
  "powerOnState": false,
  "minOutput": 10,
  "maxOutput": 90,
  "softStartTime": 50,
  "softStopTime": 30,
  "communication": {
    "lastUpdateTime": 1642678800000,
    "connectionStatus": "connected",
    "errorCount": 0,
    "responseTime": 12
  }
}
```

**调速器状态字段说明**：
- `moduleAddress`: 模块地址 (1-255)
- `isRunning`: 运行状态 (true=运行中, false=停止)
- `frequency`: 当前频率 (Hz)
- `dutyCycle`: 当前占空比 (0-100%)
- `externalSwitch`: 外接开关功能 (true=开启, false=关闭)
- `analogControl`: 0-10V控制功能 (true=开启, false=关闭)
- `powerOnState`: 开机默认状态 (true=运行, false=停止)
- `minOutput`: 最小输出百分比 (0-50%)
- `maxOutput`: 最大输出百分比 (60-100%)
- `softStartTime`: 缓启动时间 (0.1秒单位, 50=5秒)
- `softStopTime`: 缓停止时间 (0.1秒单位, 30=3秒)
- `communication`: 通信状态信息
  - `lastUpdateTime`: 最后更新时间戳 (毫秒)
  - `connectionStatus`: 连接状态 ("connected", "disconnected", "error")
  - `errorCount`: 通信错误计数
  - `responseTime`: 最后响应时间 (毫秒)

### 3.2 状态管理
采用微信小程序原生状态管理，数据结构如下：

```javascript
Page({
  data: {
    // 连接状态
    connectionStatus: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'failed'
    deviceId: '',
    
    // 控制参数
    runDuration: 5,     // 运行时长(秒)
    stopDuration: 2,    // 停止间隔(秒)
    cycleCount: 0,      // 总循环计数设置
    autoStart: true,    // 自动启动标志
    
    // 系统状态
    systemStatus: {
      state: 3,                    // 状态码 (0=停止, 1=运行中, 2=暂停, 3=启动中)
      stateName: 'STARTING',       // 状态名称
      remainingRunTime: 0,         // 剩余运行时间(秒)
      remainingStopTime: 0,        // 剩余停止时间(秒)
      currentCycleCount: 1376,     // 当前循环计数
      runDuration: 5,              // 运行持续时间设置(秒)
      stopDuration: 2,             // 停止持续时间设置(秒)
      uptime: 5585325,             // 系统运行时间(毫秒)
      freeHeap: 240060,            // 空闲堆内存(字节)
      chipTemperature: 45          // 芯片温度(摄氏度)
    },
    
    // 调速器状态
    speedControllerStatus: {
      moduleAddress: 1,            // 模块地址
      isRunning: true,             // 运行状态
      frequency: 1500,             // 当前频率(Hz)
      dutyCycle: 80,               // 当前占空比(%)
      externalSwitch: false,       // 外接开关功能
      analogControl: false,        // 0-10V控制功能
      powerOnState: false,         // 开机默认状态
      minOutput: 10,               // 最小输出百分比
      maxOutput: 90,               // 最大输出百分比
      softStartTime: 50,           // 缓启动时间
      softStopTime: 30,            // 缓停止时间
      communication: {
        lastUpdateTime: 1642678800000,  // 最后更新时间戳
        connectionStatus: 'connected',   // 连接状态
        errorCount: 0,                   // 通信错误计数
        responseTime: 12                 // 最后响应时间(毫秒)
      }
    },
    
    // UI状态
    isLoading: false,
    errorMessage: ''
  }
})
```

## 4. 用户交互流程

### 4.1 首次使用流程
1. 用户打开小程序
2. 自动进入蓝牙扫描状态
3. 显示附近ESP32-Motor设备
4. 用户点击连接按钮
5. 建立BLE连接并订阅状态通知
6. 加载默认控制参数
7. 显示实时状态信息

### 4.2 日常操作流程
1. **参数设置**：
   - 设置运行时长（滑块或输入框）
   - 设置停止间隔（滑块或输入框）
   - 参数将自动同步到设备

2. **电机控制**：
   - 电机将根据设置的运行时长和停止间隔自动运行
   - 无需手动开关控制

3. **参数调整**：
   - 运行中可调整下次循环的参数
   - 当前循环不受影响
   - 新参数在下个循环生效

## 5. 错误处理

### 5.1 连接错误
- **设备未找到**：提示"未找到ESP32-Motor设备，请确保设备已开启"
- **连接超时**：提示"连接超时，请重试"
- **连接中断**：自动重连，提示"连接已断开，正在重新连接..."

### 5.2 通信错误
- **写入失败**：提示"设置失败，请检查连接状态"
- **读取超时**：提示"获取状态超时，正在重试..."

### 5.3 参数验证
- **运行时长**：1-999秒，超出范围提示"运行时长应在1-999秒之间"
- **停止间隔**：0-999秒，超出范围提示"停止间隔应在0-999秒之间"

## 6. 性能要求

### 6.1 响应时间
- 连接建立：≤ 5秒
- 参数设置：≤ 1秒
- 状态更新：≤ 1秒

### 6.2 稳定性
- 连续运行24小时无崩溃
- BLE连接断开10秒内自动重连
- 数据同步准确率≥ 99.9%

## 7. 兼容性要求

### 7.1 微信版本
- 基础库版本：≥ 2.10.0
- 支持蓝牙API：wx.getBluetoothAdapterState

### 7.2 设备支持
- Android：6.0及以上版本
- iOS：10.0及以上版本

## 8. 开发计划

### 8.1 第一阶段：基础功能
- [ ] 重构BLE通信模块，匹配规范UUID
- [ ] 实现三个核心区域UI
- [ ] 完成基本连接和控制功能
- [ ] 添加调速器状态特征值支持

### 8.2 第二阶段：用户体验优化
- [ ] 添加动画效果和过渡
- [ ] 优化错误提示和用户引导
- [ ] 增加参数记忆功能
- [ ] 实现调速器状态展示区UI

### 8.3 第三阶段：高级功能
- [ ] 添加历史数据记录
- [ ] 支持多设备管理
- [ ] 增加定时任务功能
- [ ] 调速器状态监控和告警功能