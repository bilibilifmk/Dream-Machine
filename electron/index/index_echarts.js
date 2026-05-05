var Power_info_dom = document.getElementById('Power_info');
var Power_info_Chart = echarts.init(Power_info_dom, null, {
  renderer: 'canvas',
  useDirtyRect: false
});
// var app = {};

var Power_info_option;
Power_info_option = {

    series: [
      {
        type: 'gauge',
        center: ['50%', '60%'],
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 800,
        splitNumber: 10,
        itemStyle: {
          color: '#ffffff'
        },
        progress: {
          show: true,
          width: 15
        },
        pointer: {
          show: false
        },
        axisLine: {
          lineStyle: {
            width: 15
          }
        },
        axisTick: {
          distance: -10,
          splitNumber: 5,
          lineStyle: {
            width: 1,
            color: '#ffffff'
          }
        },
        splitLine: {
          distance: -25,
          length: 0,
          lineStyle: {
            width: 1,
            color: '#ffffff'
          }
        },
        axisLabel: {
          distance: 6,
          color: '#ffffff',
          fontSize: 10
        },
        anchor: {
          show: false
        },
        title: {
          show: false
        },
        detail: {
          valueAnimation: true,
          width: '60%',
          lineHeight: 5,
          borderRadius: 5,
          offsetCenter: [0, '30%'],
          fontSize: 21,
          fontWeight: 'bolder',
           //   formatter: '{value} W/H {value2} W/H',
            formatter: function (value) {
            // 获取当前数据对象的 `value` 和 `value2`
            const dataItem = Power_info_option.series[0].data[0];
            return `${dataItem.value2} V\n\n\n\n\n${dataItem.value3} A\n\n\n\n\n${value} W/H\n\n\n\n\n电源状态`;
            },
          color: 'inherit'
        },
        data: [
          {
            value: 40,
            value2: 40,
            value3: 80
          }
        ]
      },
      {
        type: 'gauge',
        center: ['50%', '60%'],
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 800,
        itemStyle: {
          color: '#f5aba0'
        },
        progress: {
          show: true,
          width: 10
        },
        pointer: {
          show: false
        },
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        splitLine: {
          show: false
        },
        axisLabel: {
          show: false
        },
        detail: {
          show: false
        },
        data: [
          {
            value: 40,
            value2: 40,
            value3: 80
          }
        ]
      }
    ]
  };
// setInterval(function () {
// const random = +(Math.random() * 800).toFixed(2);
// const random2 = +(Math.random() * 60).toFixed(2);
// const random3 = +(Math.random() * 60).toFixed(2);

// Power_info_Chart.setOption({
//     series: [
//       {
//         data: [
//           {
//             value: random,
//             value2: random2,
//             value3: random3
//           }
//         ],
//         detail: {
//           formatter: function (value) {
//             return `${random2} V\n\n\n\n\n${random3} A\n\n\n\n\n${value} W/H\n\n\n\n\n电源状态`;
//           }
//         }
//       },
//       {
//         data: [
//           {
//             value: random,
//             value2: random2,
//             value3: random3
//           }
//         ]
//       }
//     ]
//   });
// }, 2000);

if (Power_info_option && typeof Power_info_option === 'object') {
    Power_info_Chart.setOption(Power_info_option);
}

window.addEventListener('resize', Power_info_Chart.resize);




// var Fan_info_dom = document.getElementById('Fan_info');
// var Fan_info_Chart = echarts.init(Fan_info_dom, null, {
//   renderer: 'canvas',
//   useDirtyRect: false
// });
// var option;
// const gaugeData = [
//     {
//       value: 2000,
//       name: '主机风扇',
//       title: {
//         offsetCenter: ['0%', '-50%']
//       },
//       detail: {
//         valueAnimation: true,
//         offsetCenter: ['0%', '-40%']
//       }
//     },
//     {
//       value: 3000,
//       name: '风扇1',
//       title: {
//         offsetCenter: ['0%', '-20%']
//       },
//       detail: {
//         valueAnimation: true,
//         offsetCenter: ['0%', '-10%']
//       }
//     },
//     {
//       value: 4000,
//       name: '风扇2',
//       title: {
//         offsetCenter: ['0%', '10%']
//       },
//       detail: {
//         valueAnimation: true,
//         offsetCenter: ['0%', '20%']
//       }
//     },
//     {
//       value: 4500,
//       name: '风扇3',
//       title: {
//         offsetCenter: ['0%', '40%']
//       },
//       detail: {
//         valueAnimation: true,
//         offsetCenter: ['0%', '50%']
//       }
//     }
//   ];
  
//   option = {
//     series: [
//       {
//         type: 'gauge',
//         min: 0,
//         max: 5000,
//         startAngle: 90,
//         endAngle: -270,
//         pointer: {
//           show: false
//         },
//         progress: {
//           show: true,
//           overlap: false,
//           roundCap: true,
//           clip: false,
//           itemStyle: {
//             borderWidth: 1,
//             borderColor: '#464646'
//           }
//         },
//         axisLine: {
//           lineStyle: {
//             width: 20
//           }
//         },
//         splitLine: {
//           show: false,
//           distance: 0,
//           length: 10
//         },
//         axisTick: {
//           show: false
//         },
//         axisLabel: {
//           show: false,
//           distance: 50
//         },
//         data: gaugeData,
//         title: {
//           fontSize: 6
//         },
//         detail: {
//           width: 10,
//           height: 0.1,
//           fontSize: 5,
//           color: 'inherit',
//           borderColor: 'inherit',
//           borderRadius: 60,
//           borderWidth: 0.5,
//           formatter: '{value} RPM'
//         }
//       }
//     ]
//   };
  
//   // 更新 `value` 范围为 0-5000
//   setInterval(function () {
//     gaugeData[0].value = +(Math.random() * 5000).toFixed(0);
//     gaugeData[1].value = +(Math.random() * 5000).toFixed(0);
//     gaugeData[2].value = +(Math.random() * 5000).toFixed(0);
//     gaugeData[3].value = +(Math.random() * 5000).toFixed(0);
//     Fan_info_Chart.setOption({
//       series: [
//         {
//           data: gaugeData,
//           pointer: {
//             show: false
//           }
//         }
//       ]
//     });
//   }, 2000);

//   if (option && typeof option === 'object') {
//     Fan_info_Chart.setOption(option);
//   }

//   window.addEventListener('resize', Fan_info_Chart.resize);