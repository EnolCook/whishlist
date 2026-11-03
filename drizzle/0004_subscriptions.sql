CREATE TABLE `subscriptions` (
	`wishlist_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_password_hash` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`wishlist_id`, `user_id`),
	FOREIGN KEY (`wishlist_id`) REFERENCES `wishlists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subscriptions_user_id` ON `subscriptions` (`user_id`);