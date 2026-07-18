-- 0008_meal_plans.sql
-- Manual meal-plan slotting (P1 fast-follow) — see meal-planner-backend-spec.md.
-- NOT the AI-generated planner from 04-api-design.md's /ai/meal-plan; that
-- stays deferred to Phase 4/5. This is the "put a recipe in a day/slot"
-- primitive Recipe Detail's disabled "Add to Plan" button is waiting on.

create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');

create table meal_plan_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  -- on delete set null (not cascade): if the underlying recipe is removed
  -- or unpublished, the planned slot shouldn't silently vanish — the
  -- frontend renders a "this recipe was removed" state for a null
  -- recipe_id rather than the row disappearing out from under the plan.
  recipe_id  uuid references recipes(id) on delete set null,
  plan_date  date not null,
  meal_type  meal_type not null,
  servings   integer not null default 1 check (servings > 0),
  created_at timestamptz not null default now()
);

create index idx_meal_plan_items_user_date on meal_plan_items(user_id, plan_date);

alter table meal_plan_items enable row level security;

-- Owner-only in every direction — unlike recipes, a meal plan is never
-- shareable/public content, so there's no public-select policy here.
create policy meal_plan_items_select_own
  on meal_plan_items for select
  using (auth.uid() = user_id);

create policy meal_plan_items_insert_own
  on meal_plan_items for insert
  with check (auth.uid() = user_id);

create policy meal_plan_items_update_own
  on meal_plan_items for update
  using (auth.uid() = user_id);

create policy meal_plan_items_delete_own
  on meal_plan_items for delete
  using (auth.uid() = user_id);
