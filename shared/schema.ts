import { sql } from "drizzle-orm";
import { pgTable, text, varchar, bigint, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegram_id: bigint("telegram_id", { mode: "number" }).unique(),
  username: text("username"),
  first_name: text("first_name"),
  last_name: text("last_name"),
  password: text("password"),
});

// Categories are now stored in config/settings.json, not in database
// Keeping the type definition for compatibility with frontend
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  old_price: integer("old_price"),
  images: text("images").array().notNull(),
  category_id: text("category_id"), // Stores category ID from config (e.g., "category-1")
});

export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  product_id: varchar("product_id").references(() => products.id, { onDelete: "cascade" }),
}, (table) => ({
  uniqueUserProduct: unique().on(table.user_id, table.product_id),
}));

export const cart = pgTable("cart", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  product_id: varchar("product_id").references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
}, (table) => ({
  uniqueUserProduct: unique().on(table.user_id, table.product_id),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  telegram_id: true,
  username: true,
  first_name: true,
  last_name: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
});

export const insertCartSchema = createInsertSchema(cart).omit({
  id: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;

export type InsertCart = z.infer<typeof insertCartSchema>;
export type Cart = typeof cart.$inferSelect;
