import { join } from 'node:path';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';

const apiRoot = join(__dirname, '../..');
const monorepoRoot = join(apiRoot, '../..');
const envFiles =
  process.env.NODE_ENV === 'production'
    ? ['.env']
    : ['.env.local', '.env.development', '.env.example'];

async function createDataSource(): Promise<DataSource> {
  await ConfigModule.forRoot({
    envFilePath: envFiles.flatMap((file) => [
      join(apiRoot, file),
      join(monorepoRoot, file),
    ]),
  });

  return new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: process.env.DATABASE_NAME ?? 'zunibee',
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? '',
    entities: [join(__dirname, '../**/*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations/*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: false,
  });
}

export default createDataSource();
