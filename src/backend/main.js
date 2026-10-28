// Bainpaint backend — runs on txiki.js with full system access.
//
// Every function in `api` is callable from the page:
//   const result = await tiny.api.call('name', { ...params });
// Built-ins you get for free: ping, log, quit, win.setTitle, win.setSize,
// dialog.openFile/openFiles/pickFolder/saveFile + alert/confirm/prompt.

export const api = {
  ping: () => 'pong',

  hello: ({ name }) => `hello, ${name} — txiki.js ${tjs.version}`,

  sysinfo: () => ({
    user: tjs.system.userInfo.userName,
    cwd: tjs.cwd,
    cpus: tjs.system.cpus.length,
  }),
};

// Called once the window is up. `app` can push events to the page:
//   app.push('event-name', payload)  ->  tiny.api.on('event-name', fn)
export function init(app) {
  app.setTitle('Bainpaint');
}
