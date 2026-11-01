CREATE TABLE `api_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`session_version` integer NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_sessions_token_hash_unique` ON `api_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_sessions_user_id` ON `api_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`wishlist_id` text NOT NULL,
	`name` text NOT NULL,
	`type_id` text NOT NULL,
	`url` text,
	`image_url` text,
	`price_cents` integer,
	`priority` text,
	`person_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`wishlist_id`) REFERENCES `wishlists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`type_id`) REFERENCES `types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `items_wishlist_id` ON `items` (`wishlist_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`wishlist_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` text NOT NULL,
	PRIMARY KEY(`wishlist_id`, `user_id`),
	FOREIGN KEY (`wishlist_id`) REFERENCES `wishlists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "memberships_role" CHECK("memberships"."role" in ('owner', 'member'))
);
--> statement-breakpoint
CREATE INDEX `memberships_user_id` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_resets_token_hash_unique` ON `password_resets` (`token_hash`);--> statement-breakpoint
CREATE INDEX `password_resets_user_id` ON `password_resets` (`user_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`wishlist_id` text NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`wishlist_id`) REFERENCES `wishlists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `people_wishlist_id` ON `people` (`wishlist_id`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`wishlist_id` text NOT NULL,
	`item_id` text NOT NULL,
	`from_name` text,
	`note` text,
	`user_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`wishlist_id`) REFERENCES `wishlists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reservations_item_id_unique` ON `reservations` (`item_id`);--> statement-breakpoint
CREATE INDEX `reservations_wishlist_id` ON `reservations` (`wishlist_id`);--> statement-breakpoint
CREATE INDEX `reservations_user_id` ON `reservations` (`user_id`);--> statement-breakpoint
CREATE TABLE `types` (
	`id` text PRIMARY KEY NOT NULL,
	`wishlist_id` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`wishlist_id`) REFERENCES `wishlists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `types_wishlist_id` ON `types` (`wishlist_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`session_version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `views` (
	`id` text PRIMARY KEY NOT NULL,
	`wishlist_id` text NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`type_ids` text NOT NULL,
	`person_id` text,
	`pinned` integer NOT NULL,
	FOREIGN KEY (`wishlist_id`) REFERENCES `wishlists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "views_kind" CHECK("views"."kind" in ('all', 'types', 'person'))
);
--> statement-breakpoint
CREATE INDEX `views_wishlist_id` ON `views` (`wishlist_id`);--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`cover_image_url` text,
	`theme` text NOT NULL,
	`read_token` text NOT NULL,
	`invite_token` text NOT NULL,
	`read_password_hash` text,
	`from_template` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlists_read_token_unique` ON `wishlists` (`read_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `wishlists_invite_token_unique` ON `wishlists` (`invite_token`);