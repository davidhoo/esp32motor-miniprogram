// 类型转换测试工具
import Ble from './ble.js'

// 测试字符串到ArrayBuffer的转换
function testStringToBuffer() {
  const testCases = [
    { input: '30', expected: '30' },
    { input: '60', expected: '60' },
    { input: '0', expected: '0' },
    { input: '1', expected: '1' },
    { input: '999', expected: '999' }
  ]
  
  console.log('=== 字符串到ArrayBuffer转换测试 ===')
  
  testCases.forEach(({ input, expected }) => {
    const buffer = Ble.stringToBuffer(input)
    const result = Ble.bufferToString(buffer)
    
    console.log(`输入: "${input}"`)
    console.log(`转换后: "${result}"`)
    console.log(`预期: "${expected}"`)
    console.log(`结果: ${result === expected ? '✅ 通过' : '❌ 失败'}`)
    console.log('---')
  })
}

// 测试数字到字符串的转换
function testNumberToString() {
  const testCases = [
    { input: 30, expected: '30' },
    { input: 60, expected: '60' },
    { input: 0, expected: '0' },
    { input: 1, expected: '1' },
    { input: 999, expected: '999' }
  ]
  
  console.log('=== 数字到字符串转换测试 ===')
  
  testCases.forEach(({ input, expected }) => {
    const result = String(input)
    
    console.log(`输入: ${input} (${typeof input})`)
    console.log(`转换后: "${result}" (${typeof result})`)
    console.log(`预期: "${expected}"`)
    console.log(`结果: ${result === expected ? '✅ 通过' : '❌ 失败'}`)
    console.log('---')
  })
}

// 测试参数验证
function testParameterValidation() {
  const testCases = [
    { input: 30, type: 'runDuration', expected: true },
    { input: 0, type: 'runDuration', expected: false },
    { input: 1000, type: 'runDuration', expected: false },
    { input: 60, type: 'stopDuration', expected: true },
    { input: -1, type: 'stopDuration', expected: false },
    { input: 1000, type: 'stopDuration', expected: false }
    // systemControl相关测试已删除
  ]
  
  console.log('=== 参数验证测试 ===')
  
  testCases.forEach(({ input, type, expected }) => {
    let result = false
    
    switch (type) {
      case 'runDuration':
        result = typeof input === 'number' && input >= 1 && input <= 999
        break
      case 'stopDuration':
        result = typeof input === 'number' && input >= 0 && input <= 999
        break
      // systemControl相关case已删除
    }
    
    console.log(`类型: ${type}, 输入: ${input}`)
    console.log(`结果: ${result ? '✅ 有效' : '❌ 无效'}`)
    console.log(`预期: ${expected ? '✅ 有效' : '❌ 无效'}`)
    console.log(`测试: ${result === expected ? '✅ 通过' : '❌ 失败'}`)
    console.log('---')
  })
}

// 运行所有测试
export function runAllTypeConversionTests() {
  console.log('开始类型转换测试...\n')
  
  testStringToBuffer()
  testNumberToString()
  testParameterValidation()
  
  console.log('类型转换测试完成！')
}

// 导出测试函数
export default {
  testStringToBuffer,
  testNumberToString,
  testParameterValidation,
  runAllTypeConversionTests
}