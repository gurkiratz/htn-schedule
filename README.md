# HTN 2026 schedule

A slightly nicer way to stare at the [official Hack the North calendar](https://my.hackthenorth.com/schedule).

List / day / week, tap a category, grab an `.ics`, go to a workshop. That's the whole app. No account, no backend, no "syncing your vibes."

See something cursed? [Open a PR.](https://github.com/gurkiratz/htn-schedule) I will not stop you.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static files in dist/
```

Events live in `src/data/events.json`. Times are Waterloo o'clock on purpose.

`schedule.html` is the actual HTML I pulled from [the official schedule](https://my.hackthenorth.com/schedule). `npm run extract` turns that dump into the json.

> Made with Claude Opus 5 and Cursor Grok 4.6 in around 30 minutes.
