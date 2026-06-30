New Herland District - 049-050  |  020-020
     Bridge Crossing - 036-037  |  012-012
      Unheard Shores - 025-025  |  010-010
       Illusion Town - 049-050  |  022-022
    Minguel District - 045-045  |  014-015
---------------------------------------------               
               Total - 204-207  |  078-079

http://127.0.0.1:5050/browser/?pgsql=postgres%3A5432&username=proworkspace&db=proworkspace&ns=public


below is little bit implemented by some other ai agent, but is not corrent all, i want you to fix and remove and readd feature again, like zeruxjs/theme package are importing from zeruxjs directly or so, i see that code somewhere i don't know where,
here is path infos:
- ZeruxJS Package at /home/shubham/Dev/apps/node/ZeruxJS/packages/zeruxjs
- application path at /home/shubham/Dev/proworkspace/apps/proworkspace

add easy theme features in "zeruxjs" package @contextScopeItemMention 
- add light/dark/system theme mode,
- default will be system mode, and loop in system->dark->light->system,
- send header request for prefers-color-scheme in @header.ts
- all theme should write based on html tag have class preset and style attribute for color prefrence from server, so even choosen system, on page load there should not a jump of theme,
- make sure everything is working, you can check everything change from zerux.shubkb.me/admin/domains, as npm run dev is running which run on watch, if i need i will restart server myself, most you can do is npm run build on package that you editied in /packages folder packages,
- provide theme funtions from zeruxjs/theme which are setTheme(mode: 'light' | 'dark' | 'system'), getThemeMode(), getThemeByPrefersColor(), getThemeLabel(mode: 'light' | 'dark' | 'system'), getThemeIcon(mode: 'light' | 'dark' | 'system' default getThemeMode whihc is by cookie) // return svg string, 
- for theme setting configuration it can relay on zerux.config.ts file, where theme: {default: "system", cookieName: "theme" // by deafult, disablePrefrenceHeader: false // by deafult, scriptPosition: "head" // by deafult other option body-top, body (means at end of body before closing tag), scriptType: "module" // by default other option "nomodule", scriptLoadType: "async" // by deafult other option "defer" }

fix design in site page @contextScopeItemMention, css at @contextScopeItemMention  
- make it mobile first friendly, and responsive,
- add theme switch with button at top right corner of application for mobile and for desktop in top bar, button should use 
- on mobile switch side menu to hamburger
