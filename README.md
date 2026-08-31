# 台股真實 K 線網站版

這一版和之前「直接開 index.html」不同：
瀏覽器只向你自己的網站請求 `/api/...`，再由 Node.js 後端去取得 TWSE 公開資料，所以可以避開 iPhone 本機 HTML 的跨網域限制。

## 最簡單部署方式：Render

1. 建立 GitHub repository，把這個資料夾全部上傳。
2. 到 Render 建立 Web Service。
3. 選擇該 GitHub repository。
4. Build Command：`npm install`
5. Start Command：`npm start`
6. 部署完成後，Render 會給你一個 https 網址。
7. 用 iPhone Safari 打開該網址即可。

## 本機測試

需要 Node.js 18+：

npm install
npm start

然後瀏覽器打開：
http://localhost:3000

## 功能

- 輸入上市股票 / ETF 代號
- 最新盤後行情
- 嘗試盤中即時行情
- 1 / 3 / 6 / 12 個月日 K
- 成交量
- 手機版介面

資料來源：
- TWSE OpenAPI STOCK_DAY_ALL
- TWSE STOCK_DAY 歷史資料
- TWSE MIS 即時行情（若可取得）
