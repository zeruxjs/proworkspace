So, we are going to complete notes application -> /home/shubham/Dev/proworkspace/apps/proworkspace/app/{notes},

develop in sequence:
- now we need more database tables, for that add database table at time of installation in /home/shubham/Dev/proworkspace/apps/proworkspace/lib/db.ts.
- after that develop a application here in notes that have full notion like support, sidebar of notion like + obesdian md like
- support all normal text things like heading, title, text, header, image, link, tables, kabon, and much more
- data store in DB will be all markdown format.
- we can create folder and pages in spaces, means we can create unlimited folder and pages in space, plus sub folder and sub page can be created, means a page can have sub page and a folder have pages in too but space will be main out.
- when we create space, we will have unique ID for it like little long ID, which is not primary ID but id used in URL and sharing.
- url structure will be like /{space-id}/{folder-name}/{page-name} or {space-id}/{page-name}/{folder-name} or /{space-id}/{folder-name}/{sub-folder}/{page-name}
- When we share, we creates share link, share link can be multiple and revoke too, or one time, or unlimited time, we will have control over it.
- we can also add people too, if user not exist then send invite to that email
- if user not exist, then can signup and create account and join the space, or just access the shared link without account if shared to view without auth,
- we can set things to public too, main thing is heirarcy where we edit, it take pririty till end and before till manual edit is present, means we can make some part public but all other private, 
- public can be view without login,
- shared link add to others shared section, where if they not have edit action they can request access,
- also add commention support everywhere.
- Have all settings page ready too.
- we also have E2E encypted notes support in future, so create table with that in mind.
- application is running at zerux.shubkb.me but not visit it, as previous DB is already have data, i will do it manually, you just complete all code.












Make Fixes
- Change Design, it will be single WYSIWYG editor, and save will be done as Database as Markdown,
- I can choose update as markdown, then it will change to split view like now, also i find editor is not that well, create well fully working.
- I see i cannot create spaces, there is just mention of space, but i want that i can create sapce, and give it any name and anything, i can make space public or private
- next nothing at all working on page, i do, it update on page, but nothing on database, and when refresh all data lose from page view too, everything, from link sharing to comment to every content notes, folder, page and all.
- also add sync support between multiple devices, multi people edit, realtime, you can explore zeruxjs package, as it have websocket support.
- Have offline support with PWA, and as soon get online sync based on time last edited.
- Add support for Tag and Category to all space, page, folders,
- have shortcut key support,
- search support.
- dark mode have already little bit implemented you can see what to do from lib/admin.ts, you can even out thing from admin.ts and create theme.ts, and use in admin.ts and for here both.






full application path - /home/shubham/Dev/proworkspace/apps/proworkspace
notes application path - /home/shubham/Dev/proworkspace/apps/proworkspace/app/{notes}
ZeruxJS packages - /home/shubham/Dev/proworkspace/apps/proworkspace/packages

- Add support to add websocket support in zeruxjs framework, where have to add websocket settings in zerux.config.ts, by default its off, we can on it if we want to use websocket, 
- As server starts from /home/shubham/Dev/proworkspace/apps/proworkspace/packages/zsrv, need changes here too, as its for all server start thing at one place.
- run "npm run build" for all package you edit in


- add websocket enable in /home/shubham/Dev/proworkspace/apps/proworkspace/zerux.config.ts, and make it available at all path at /ws of all application.
- I see that its API still not working, like response for comment is: https://zerux.shubkb.me/notes/api/workspace POST {action: "comment", body: "meow meow"} -> {ok: false, status: 404, message: "Page not found."}, fix properly, its just one example, but nothing is working
- also i see as api fail it try 5 api repeat call again and again manyh times, its a pag, thing, i thik i said to use Websocket for realtime sync, use that properly
- Dark Mode is not well implemented, and many things still not fix,
- In editor, like for table i cannot add row or column for table, cannot edit specific section of like, means if i click h1, it apply on whole line of text, not just selected text.
- much more need fix, fix all.
