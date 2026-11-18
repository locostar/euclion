ALTER TABLE `classes` ADD `monthly_fee` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `seat_occupancy` ADD `monthly_fee` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `fingerprint_status` text DEFAULT 'not_registered' NOT NULL;