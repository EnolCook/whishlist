CREATE TABLE `email_confirmations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "email_confirmations_purpose" CHECK("email_confirmations"."purpose" in ('verify', 'change'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_confirmations_token_hash_unique` ON `email_confirmations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `email_confirmations_user_id` ON `email_confirmations` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_confirmations_user_purpose` ON `email_confirmations` (`user_id`,`purpose`);--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` text;--> statement-breakpoint
-- Comptes créés avant la validation des adresses : vérifiés d'office (010, FR-005b).
UPDATE `users` SET `email_verified_at` = `created_at`;
