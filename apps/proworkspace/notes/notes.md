develop site insde of [isntaller] pages,
it will be multi step single page form, for will be like
2 checkbox from select from in style of buttons, One Organization or Multi - organization
next create Organization data - Organization name, allow only site domain email user or other too, or selected eamil users(this settings can be change in future)
next take user account data take - create admin account - email(based on last settings), password, First name, last name,
send data to create - site.ts api after client js verification
now start editing api / create - site, here again check, sanatize and verify data, then start below
create tables as below:
organizations
columns: id, name, status, email_policy(only_domain, selected_email_users(seprated by comma), anyone), domain, logo, slug, status
options:
columns: id, key, value, autoload
org_options:
columns: id, org_id, key, value, autoload
users
columns: id, org_id, user_id, first_name, last_name, email, password, role, status
usermeta
columns: id, user_id, key, value
groups:
columns: id, org_id, name, description, status, capabilities, created_at, updated_at
sites:
columns: id, org_id, site, for, status, created_at, updated_at
and in options add row where key = "installed" and value = "yes"
all instide lib/db.ts which will create db and add,
create org
add organization 
then add data create user, add site, where current domain for = "admin",
create default groups adminstrator, maintainer, employee
usermeta to add roles key where value will be adminstrator
make sure do all in transaction and rollback if anything fails, else comit
and api will return either error, or redirect to home,
and edit basic welcome page [admin]/page.ts
also in apps/proworkspace/middleware/connect-db.ts we have to get site of current domain if state.installed=true