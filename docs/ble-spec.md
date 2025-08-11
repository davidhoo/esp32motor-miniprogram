# ESP32-Motor BLE通信协议规范

## 1. 设备信息
- **设备名称**: `ESP32-Motor-Control`
- **广播名称**: `ESP32-Motor-Control`
- **连接方式**: BLE 4.2+

## 2. BLE服务与特征值

### 2.1 服务定义
| 服务名称 | UUID | 说明 |
|----------|------|------|
| 主服务 | `beb5483e-36e1-4688-b7f5-ea07361b26a8` | 电机控制主服务 |

### 2.2 特征值定义
| 功能 | UUID | 数据类型 | 读写权限 | 说明 |
|------|------|----------|----------|------|
| 运行时长 | `2f7a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c6` | uint32 | R/W | 1-999秒，小端格式 |
| 停止间隔 | `3f8a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c7` | uint32 | R/W | 0-999秒，小端格式 |
| 系统控制 | `4f9a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c8` | uint8 | R/W | 0=停止, 1=启动 |
| 状态查询 | `5f9a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c9` | JSON | R | 系统状态信息 |

## 3. 数据格式

### 3.1 数值型数据
- **uint8**: 单字节无符号整数 (0-255)
- **uint32**: 4字节无符号整数，小端格式

### 3.2 JSON状态信息
```json
{
  "state": 3,                   // 系统状态码: 0=停止, 1=运行中, 2=暂停, 3=启动中
  "stateName": "STARTING",      // 状态名称: "STOPPED"/"RUNNING"/"PAUSED"/"STARTING"
  "remainingRunTime": 0,        // 剩余运行时间(秒)
  "remainingStopTime": 0,       // 剩余停止时间(秒)
  "currentCycleCount": 1376,    // 当前循环计数
  "runDuration": 5,             // 运行持续时间设置(秒)
  "stopDuration": 2,            // 停止持续时间设置(秒)
  "cycleCount": 0,              // 总循环计数设置
  "autoStart": true,            // 自动启动标志
  "uptime": 5585325,            // 系统运行时间(毫秒)
  "freeHeap": 240060            // 空闲堆内存(字节)
}
```

**状态码说明**：
- `0`: STOPPED - 系统已停止
- `1`: RUNNING - 系统运行中
- `2`: PAUSED - 系统暂停
- `3`: STARTING - 系统启动中

**字段详细说明**：
- `state`: 当前系统状态的数字代码
- `stateName`: 当前系统状态的文字描述
- `remainingRunTime`: 当前运行阶段的剩余时间
- `remainingStopTime`: 当前停止阶段的剩余时间
- `currentCycleCount`: 已完成的循环次数
- `runDuration`: 每次运行的持续时间设置
- `stopDuration`: 每次停止的持续时间设置
- `cycleCount`: 总循环次数设置(0表示无限循环)
- `autoStart`: 是否启用自动启动功能
- `uptime`: 设备从启动到现在的总运行时间(毫秒)
- `freeHeap`: 当前可用的堆内存大小

## 4. 通信流程

### 4.1 连接流程
1. 扫描设备名称 `ESP32-Motor`
2. 建立BLE连接
3. 发现主服务 `beb5483e-36e1-4688-b7f5-ea07361b26a8`
4. 订阅状态查询特征值通知

### 4.2 控制流程
1. **启动电机**:
   - 写入运行时长 (特征值: `2f7a9c2e...`)
   - 写入停止间隔 (特征值: `3f8a9c2e...`)
   - 写入系统控制=1 (特征值: `4f9a9c2e...`)

2. **停止电机**:
   - 写入系统控制=0 (特征值: `4f9a9c2e...`)

3. **状态监控**:
   - 读取状态查询特征值获取实时状态
   - 或通过通知自动接收状态更新

## 5. 错误处理
- 参数超出范围时返回错误码
- 设备离线时返回连接错误
- JSON格式错误时返回解析错误

## 6. 示例代码

### 6.1 启动电机
```javascript
// 设置运行时长30秒
const runDuration = new Uint32Array([30]);
writeCharacteristic('2f7a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c6', runDuration.buffer);

// 设置停止间隔60秒
const stopInterval = new Uint32Array([60]);
writeCharacteristic('3f8a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c7', stopInterval.buffer);

// 启动电机
const control = new Uint8Array([1]);
writeCharacteristic('4f9a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c8', control.buffer);
```
### 6.2 读取状态
```javascript
readCharacteristic('5f9a9c2e-6b1a-4b5e-8b2a-c1c2c3c4c5c9')
  .then(buffer => {
    const decoder = new TextDecoder();
    const json = decoder.decode(buffer);
    const status = JSON.parse(json);
    
    console.log('系统状态:', status);
    console.log('状态码:', status.state, '状态名:', status.stateName);
    console.log('运行设置:', status.runDuration, '秒');
    console.log('停止设置:', status.stopDuration, '秒');
    console.log('剩余运行时间:', status.remainingRunTime, '秒');
    console.log('剩余停止时间:', status.remainingStopTime, '秒');
    console.log('当前循环:', status.currentCycleCount, '次');
    console.log('系统运行时间:', status.uptime, '秒');
    console.log('空闲内存:', status.freeHeap, '字节');
  });
```

### 6.3 状态判断示例
```javascript
function getMotorStatusText(state, stateName) {
  const statusMap = {
    0: { text: '已停止', color: 'red', icon: '🔴' },
    1: { text: '运行中', color: 'green', icon: '🟢' },
    2: { text: '已暂停', color: 'yellow', icon: '🟡' },
    3: { text: '启动中', color: 'blue', icon: '🔵' }
  };
  
  return statusMap[state] || { text: stateName, color: 'gray', icon: '⚪' };
}

// 使用示例
const statusInfo = getMotorStatusText(3, 'STARTING');
console.log(`电机状态: ${statusInfo.text} ${statusInfo.icon}`);
```