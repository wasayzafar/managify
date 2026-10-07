-- New accounts start with no plan ('none') and are asked to choose one before
-- they can use the app. Existing rows keep the plan they already have (the
-- grandfathered 'max' values from 005), because changing a column default
-- never rewrites existing rows.

alter table user_registry drop constraint if exists user_registry_plan_check;
alter table user_registry alter column plan set default 'none';
alter table user_registry add constraint user_registry_plan_check check (plan in ('pro', 'max', 'none'));
