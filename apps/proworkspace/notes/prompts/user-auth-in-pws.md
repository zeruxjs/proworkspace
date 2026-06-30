Now start work on Proworkspace auth - /home/shubham/Dev/proworkspace/apps/proworkspace, use zeruxjs/auth from /home/shubham/Dev/apps/node/ZeruxJS/packages/zeruxjs -> /home/shubham/Dev/apps/node/ZeruxJS/packages/@zeruxjs/auth

we have to add these case, don't allow user to sign up (will let admin create in future), or allow anyone, + we will build whole cycle well,
all login will place at /home/shubham/Dev/proworkspace/apps/proworkspace/app/{accounts}/signup and /home/shubham/Dev/proworkspace/apps/proworkspace/app/{accounts}/signin
where sign up requires email first, it will be based on setup time who can register, 
  - First take Name, Last name,
  - Take DOB and Gender, DOB can be set from admin, default 13+ years old can register,
  - then email, if anyone then anyone can register with any email or else allowed domain email, there will be create account with own email option too, like will creating google account we add {our user name}@{gmail.com fixed}, we can set to create fix once,
  - then accept term and conditions, privary policy and all login will create, this data will got option temp data of table and will set to delete in 30m by default if not complete process,
  - complete /home/shubham/Dev/proworkspace/apps/proworkspace/scripts/start.sh for cron job that will create cron run every 5m by default, other things will handled dynamiicly by application if it choose 30m, then it will ignore all cron request and only complete 30m gap requests?
  - also complete /home/shubham/Dev/proworkspace/apps/proworkspace/components/UserHeaderProfile.ts, it will be like google like top user account image, and on open it show details and other option properly, it will be take prop too that is to show other apps short link to open notes, git, mail and all other left account and admin, admin will show when have admin access?
  - next we have to make it use of capabilities and add them on page or site, like admin site should be accessable by adminstrator, or if costom role added with admin capability, and so based on auth,
  - add passkey on application too by default + 2FA too for email and both?
  - be security top priority, 