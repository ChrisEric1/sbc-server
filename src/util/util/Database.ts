/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { green, red, yellow } from "picocolors";
import { DataSource } from "typeorm";
import { ConfigEntity } from "../entities/Config";
import { Migration } from "../entities/Migration";
import { Datasource } from "./Datasource";

// UUID extension option is only supported with postgres
// We want to generate all id's with Snowflakes that's why we have our own BaseEntity class

// Called once on server start
export async function initDatabase(): Promise<DataSource> {
	if (Datasource.isInitialized) return Datasource;

	const DatabaseType = Datasource.options.type;
	const isSqlite = DatabaseType.includes("sqlite");

	if (isSqlite) {
		console.log(
			`[Database] ${red(
				`You are running sqlite! Please keep in mind that we recommend setting up a dedicated database!`,
			)}`,
		);
	}

	if (!process.env.DB_SYNC) {
		const supported = ["mysql", "mariadb", "postgres", "sqlite"];
		if (!supported.includes(DatabaseType)) {
			console.log(
				"[Database]" +
					red(
						` We don't have migrations for DB type '${DatabaseType}'` +
							` To ignore, set DB_SYNC=true in your env. https://docs.spacebar.chat/setup/server/configuration/env/`,
					),
			);
			process.exit();
		}
	}

	console.log(`[Database] ${yellow(`Connecting to ${DatabaseType} db`)}`);

	await Datasource.initialize();

	// Crude way of detecting if the migrations table exists.
	const dbExists = async () => {
		try {
			await ConfigEntity.count();
			return true;
		} catch (e) {
			return false;
		}
	};
	if (!(await dbExists())) {
		console.log(
			"[Database] This appears to be a fresh database. Synchronising.",
		);
		await Datasource.synchronize();

		// On next start, typeorm will try to run all the migrations again from beginning.
		// Manually insert every current migration to prevent this:
		await Promise.all(
			Datasource.migrations.map((migration) =>
				Migration.insert({
					name: migration.name,
					timestamp: Date.now(),
				}),
			),
		);
	} else {
		console.log("[Database] Applying missing migrations, if any.");
		await Datasource.runMigrations();
	}

	console.log(`[Database] ${green("Connected")}`);

	return Datasource;
}

export async function closeDatabase() {
	await Datasource?.destroy();
}
