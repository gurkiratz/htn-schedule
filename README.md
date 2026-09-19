# HTN 2026 schedule

A slightly nicer way to stare at the Hack the North calendar.

List / day / week, tap a category, grab an `.ics`, go to a workshop. That's the whole app. No account, no backend, no "syncing your vibes."

See something cursed? [Open a PR.](https://github.com/gurkiratz/htn-schedule) I will not stop you.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static files in dist/
```

Events live in `src/data/events.json`. Times are Waterloo o'clock on purpose.
