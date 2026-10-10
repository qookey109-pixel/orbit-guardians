# ORBIT // CODE — 軌道守護者

**Pure Minimal Abstract V0.6.1** · 傅立葉圓周軌道益智遊戲 · 繁體中文

🎮 **[立即遊玩（GitHub Pages）](https://qookey109-pixel.github.io/orbit-guardians/)**

## 遊戲規則

- 共六關，每次最多使用 **3 個圓**
- 玩家調整圓數、半徑及順／逆旋轉方向；轉速固定為 1×、2×、3×，起始角度為 0°
- 可直接在遊戲畫面用滑鼠或觸控拖曳半徑，也能使用控制面板調整
- 綠色物資訊號可任意順序收集，同一訊號不會重複計分
- 命中半徑約 8～10 世界座標單位；須避免紅色禁區
- 純前端 HTML / CSS / JavaScript，無付費 API、無伺服器

## 發布

`index.html` 為遊戲主頁，GitHub Actions 的 `Deploy GitHub Pages` 工作流程會在 main 分支更新時自動部署。

如果第一次部署尚未啟用 Pages，請在 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。

## 版本

- **V0.6.1**：Pure Minimal Abstract；移除粒子、星雲、背景光絲、掃描線及多餘 HUD，保留簡約幾何軌跡、抽象核心及必要操作資訊。
- **V0.6**：Luminous 光影風格。
- **V0.5**：三圓上限、物資訊號任意順序收集、精準判定。
- **V0.3**：滑鼠／觸控拖曳半徑。

## 驗收

- `.github/workflows/browser-smoke.yml` 在雲端 Chromium 驗證桌面與手機基本操作、三圓上限、半徑拖曳、六關參考路線、無水平溢出與 JavaScript 錯誤。
- 本遊戲完全在瀏覽器中執行，不需 API。

