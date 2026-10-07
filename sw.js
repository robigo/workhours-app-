const CACHE='worktime-v91';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={title:'WorkTime',body:'יש לך תזכורת מ-WorkTime'};
 try{if(event.data)data={...data,...event.data.json()}}catch{}
 event.waitUntil(self.registration.showNotification(data.title,{body:data.body,tag:data.tag||'worktime',data:{url:data.url||'./?v=91'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=(event.notification.data&&event.notification.data.url)||'./?v=91';
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
   for(const c of list){if('focus'in c){c.navigate(url);return c.focus()}}
   return clients.openWindow(url);
 }));
});