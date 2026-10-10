# ORBIT // CODE — 軌道守護者

**Pixel Edition V0.5** · 傅立葉圓周軌道益智遊戲 · 繁體中文

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

- **V0.5**：三圓上限、物資訊號任意順序收集、精準判定
- 保留 V0.2 像素太空背景及 V0.3 滑鼠／觸控半徑調整

