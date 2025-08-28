# Stock Market Prediction Game

Guess if the next trading day closes higher or lower based on real market data from Alpha Vantage.

## How it works

- Enter any valid stock ticker (e.g., MSFT, COF).
- The app fetches daily close prices via Alpha Vantage (no demo data).
- It randomly selects a non-holiday weekday between 7 and 100 days ago as the starting date.
- The chart shows the 7 trading days before the start date plus the start date itself.
- You predict up/down for the next day; the app reveals the result, updates score, date, and the chart.
- Continue until you end the game or you reach the most recent trading day available.

## Local preview

This is a static site. You can open `index.html` directly in a browser, or run a simple server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Deploy to GitHub Pages

1. Create a new GitHub repository and push these files.
2. In GitHub, go to Settings → Pages.
3. Under "Build and deployment", set Source to "Deploy from a branch".
4. Choose the `main` branch and the `/ (root)` folder.
5. Save. Your site will be available at the provided Pages URL in a minute.

## Notes

- Data provided by Alpha Vantage (free tier limits apply: you may encounter temporary rate limits).
- The provided API key is embedded for GitHub Pages simplicity. For production, consider proxying requests server-side.

# stock-predictor