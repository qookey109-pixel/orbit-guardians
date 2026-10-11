# ORBIT // CODE × AI Resource Hub — 實作優先順序

更新：2026-10-11 · 以 V1.9 Motion Polish 為基線

## 不變的產品原則

- GitHub Pages 純前端、零付費 API，優先支援手機／Safari／一般桌機。
- 遊戲始終是 3 顆星球 × 6 關、總共 18 關、無倒數；玩家修改半徑和方向，目標軌道與危險區判定保持一致。
- 單畫面 Console HUD。星級和結算面板已暫停，不因加入任何視覺技術而復活。
- 不要求額外下載 AI 模型或 3D 資產才能開始遊玩；較高畫質效果應能降級關閉。
- 尊重 `prefers-reduced-motion`；任何動畫不得改變物理模型、判定結果或阻擋「下一關」。

## 資源決策表

| 資源 | 優先級 | 現階段決定 | 背後考量 |
| --- | --- | --- | --- |
| Anime.js · https://github.com/juliangarnier/anime | P0 參考 | **參考動效邏輯，不安裝 runtime** | 現有遊戲以單一 Canvas + requestAnimationFrame 直接渲染；先用極短、確定性的內建回饋降低依賴與版本風險。若日後大量 DOM 過場才評估 Anime.js v4。倉庫採 MIT。 |
| 60fps.design · https://60fps.design/ | P0 參考 | **作為微互動與運動節奏參考** | 成果驗收應看操作手感與實際效能，不把 60 FPS 當作所有硬體都保證。 |
| UI Skills · https://www.ui-skills.com/skills | P1 參考 | **延續 Focus HUD 減少控制區** | 確保選圓、半徑、方向三種操作在第一層，其他控制可收合。 |
| React Bits Shape Grid · https://reactbits.dev/backgrounds/shape-grid | P2 候選 | **不把 React 掛到既有遊戲** | 若未來增加獨立的新首頁可先在隔離頁實驗；既有星空視覺不應被動畫網格覆蓋。 |
| ThreeUI · https://github.com/MengTo/threeui | P2 研究 | **暫不導入 React/Three.js 執行環境** | Community 授權 MIT，但含 React/Three.js 生態與獨立資產界線；未來先做原生 Canvas 2.5D 行星概念驗證。 |
| Three.js Mechanical Deployables · https://github.com/trungdq88/mechanical-deployables-treejs | P2 參考 | **僅作變形／展開動作參考** | 目前 HUD 不需要複雜 3D 機械元件。 |
| PixelArtBase · https://www.pixelartbase.com/ | P2 評估 | **素材逐件檢查來源、再考慮替換** | 避免混用不同風格與不明授權的圖像。 |
| SoundShockAudio · https://soundshockaudio.com/ | 暫緩 | **不得直接批次搬素材進 Repo** | 目前網站 Terms（2026-03-10）包含個人、非商用與禁止重新散布等限制；個別音訊權利應再逐項確認。暫用已內建 Web Audio 短音效。 |
| Meshy AI · https://www.meshy.ai/ | P3 候選 | **無須現在引入 3D 模型** | 模型下載體積、授權和手機效能需先量測。 |
| vgpu · https://github.com/vercel-labs/vgpu | P3 技術觀察 | **不導入 WebGPU** | 三圓×18 關算量極小，先以 CPU 及 Canvas 2D 繼續運作，避免 WebGPU 相容性成本；該專案 MIT。 |
| Skill of Skills · https://github.com/the911fund/skill-of-skills | P1 開發期 | **用於關卡生成／驗證流程，而非玩家端 LLM** | 可研究離線產生候選關卡、校驗參考路徑與碰撞距離、產生測試 artifacts；玩家端不需模型。 |
| MCP.so · https://mcp.so/zh/servers | P3 探索 | **避免無目的引入新的 MCP 伺服器** | 有明確的建關、自動截圖、音效製作需求才評估。 |

## V1.9 實作：原生 Motion Polish

- 預測航線：半徑編輯後 **640ms** 的移動微光；原本的完整預測線、危險區紅段與方向箭頭從頭到尾保持可見。
- 拖曳控制點：選中圓周時增強環狀提示；第一個或最後一個圓上的飛船和拖曳控制點也能辨識。
- 補給收集：6 顆固定角度的短暫光點，不載入粒子套件、貼圖與新增 HTTP 請求。
- 預測開關指示燈：少量亮度起伏；系統選擇減少動態效果時關閉。
- 三圓物理、目標命中半徑、風險路徑、音效開關、手把輸入、無倒數與下一關均不變。

## 下一步的品質門檻

1. 每次上線須通過 Playwright：18 關、保存紀錄、分享連結、解鎖流程，以及 8 種桌機/手機螢幕無整頁捲動。
2. 新增動效須有 `prefers-reduced-motion` 或直接取消的途徑；不能影響滑桿即時預測。
3. 引入任何 runtime 前提出單獨效能對照：手機 Safari、桌面 Chromium 的平均和 P95 frame time、初始載入量，以及離線後是否仍能遊玩。
4. **Agent 式關卡驗證**應先在 GitHub Actions / 開發腳本裡工作，檢查參考配置的路徑是否經過每個目標、是否意外撞到禁區；不可只用遊戲 Debug 函式直接替關卡標記通過。
5. 未取得可用素材授權憑證時，不向網站包入音效、字體、貼圖或 3D 模型。

此文件是採用決策記錄，不代表已整合清單內的所有第三方程式。
