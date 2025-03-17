// import React, { useEffect, useRef } from 'react';
// import * as PIXI from 'pixi.js';
// import { Live2DModel } from 'pixi-live2d-display';

// // 将 PIXI 暴露到 window 上，这样插件就可以通过 window.PIXI.Ticker 来自动更新模型
// window.PIXI = PIXI;

// export function VirtualRoleCanvas() {
//   useEffect(() => {
//     const app = new PIXI.Application();

//     app
//       .init({
//         resizeTo: window,
//       })
//       .then(() => {
//         let v_role_wrap = document.getElementById('virtual_role_canvas');

//         if (v_role_wrap) {
//           v_role_wrap.appendChild(app.canvas);
//         }
//         // from model json, in public/live2d_resources

//         Live2DModel.from(
//           `${process.env.NEXT_PUBLIC_BASE_PATH}/live2d_resources/Mao/Mao.model3.json`,
//         ).then((model: any) => {
//           app.stage.addChild(model);
//           model.anchor.set(0.5, 0.5);
//           model.position.set(app.screen.width / 2, app.screen.height / 2);
//           model.scale.set(0.5);
//         });
//       });
//   }, []);

//   return <div id="virtual_role_canvas"></div>;
// }
