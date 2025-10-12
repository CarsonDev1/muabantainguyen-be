'use strict';

import { pool } from '../src/setup/db.js';

const templates = {
	account: (index, productName) => `Username: premium.user${String(index).padStart(3, '0')}@example.com
Password: SecurePass${String(index).padStart(3, '0')}!@#
Email: backup${String(index).padStart(3, '0')}@gmail.com
Phone: +84-${String(index).padStart(3, '0')}-XXX-XXX
Profile PIN: ${String(1000 + index).slice(-4)}
Product: ${productName}
Plan: Premium
Region: Vietnam
Server: VN-${String((index % 5) + 1).padStart(2, '0')}
Valid Until: 2026-12-31

Login URL: https://example.com/login
Instructions:
1. Login with username/password above
2. DO NOT change password or email
3. DO NOT add payment method
4. Contact support if any issue within 24h

Support: support@yourshop.com
Created: ${new Date().toISOString()}`,

	license: (index, productName) => `LICENSE KEY: ${generateLicenseKey()}
Product: ${productName}
Product Code: PROD-${String(index).padStart(4, '0')}
Activation Limit: 1 device
Platform: Windows/Mac/Linux
Language: Multi-language
Valid Until: Lifetime

Activation Instructions:
1. Download from: https://example.com/download
2. Install and open the application
3. Enter license key when prompted
4. Activation is instant and offline

Support: license@yourshop.com
Documentation: https://docs.example.com
Issued: ${new Date().toISOString()}`,

	apiKey: (index, productName) => `API KEY: sk_live_${generateRandomString(32)}
API SECRET: ${generateRandomString(48)}
Product: ${productName}
Environment: Production
Rate Limit: 10,000 requests/hour
Valid Until: 2026-12-31

Usage:
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.example.com/v1/endpoint

Documentation: https://docs.example.com/api
Dashboard: https://dashboard.example.com
Support: api@yourshop.com
Created: ${new Date().toISOString()}`,
};

function generateRandomString(length) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

function generateLicenseKey() {
	const part = () => generateRandomString(4).toUpperCase();
	return `${part()}-${part()}-${part()}-${part()}`;
}

function determineTemplate(productName) {
	const name = productName.toLowerCase();

	if (name.includes('license') || name.includes('key')) {
		return templates.license;
	} else if (name.includes('api')) {
		return templates.apiKey;
	}

	return templates.account;
}

async function seedInventory() {
	try {
		console.log('🌱 Starting inventory seed...\n');

		// Get all active products
		const { rows: products } = await pool.query(`
      SELECT id, name, slug 
      FROM products 
      WHERE is_active = TRUE
      ORDER BY name
    `);

		if (products.length === 0) {
			console.log('⚠️  No active products found. Please create products first.');
			return;
		}

		console.log(`Found ${products.length} active products\n`);

		const batchId = `SEED-${new Date().toISOString().split('T')[0]}-${Date.now()}`;
		let totalAdded = 0;

		for (const product of products) {
			// Check existing inventory
			const { rows: existing } = await pool.query(
				`SELECT COUNT(*) as count FROM inventory_items 
         WHERE product_id = $1 AND is_sold = FALSE`,
				[product.id]
			);

			const existingCount = parseInt(existing[0].count);
			const targetCount = 20;
			const needToAdd = Math.max(0, targetCount - existingCount);

			if (needToAdd === 0) {
				console.log(`✓ ${product.name}: Already has ${existingCount} items`);
				continue;
			}

			console.log(`📦 ${product.name}: Adding ${needToAdd} items...`);

			const template = determineTemplate(product.name);

			for (let i = 0; i < needToAdd; i++) {
				const secretData = template(existingCount + i + 1, product.name);

				await pool.query(
					`INSERT INTO inventory_items (
            product_id, secret_data, batch_id, 
            account_expires_at, source, is_sold
          ) VALUES ($1, $2, $3, NOW() + INTERVAL '12 months', 'seed', FALSE)`,
					[product.id, secretData, batchId]
				);
			}

			totalAdded += needToAdd;
			console.log(`  ✓ Added ${needToAdd} items\n`);
		}

		// Sync stock
		await pool.query(`
      UPDATE products p
      SET stock = (
        SELECT COUNT(*) 
        FROM inventory_items i
        WHERE i.product_id = p.id AND i.is_sold = FALSE
      )
    `);

		console.log(`\n✅ Seed completed! Added ${totalAdded} inventory items total.`);
		console.log(`Batch ID: ${batchId}\n`);

		// Show summary
		const { rows: summary } = await pool.query(`
      SELECT * FROM v_inventory_stats ORDER BY product_name
    `);

		console.log('📊 Inventory Summary:');
		console.log('─'.repeat(90));
		console.log(
			'Product'.padEnd(30),
			'Total'.padEnd(10),
			'Available'.padEnd(10),
			'Sold'.padEnd(10),
			'Expiring'.padEnd(10)
		);
		console.log('─'.repeat(90));

		for (const row of summary) {
			console.log(
				row.product_name.padEnd(30),
				row.total_items.toString().padEnd(10),
				row.available_items.toString().padEnd(10),
				row.sold_items.toString().padEnd(10),
				row.expiring_soon.toString().padEnd(10)
			);
		}
		console.log('─'.repeat(90));
	} catch (error) {
		console.error('❌ Error seeding inventory:', error);
		throw error;
	} finally {
		await pool.end();
	}
}

seedInventory()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
