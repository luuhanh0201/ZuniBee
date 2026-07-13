import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AiProvider } from '@zunibee/shared';
import { AiProviderEntity } from './entities/ai-provider.entity';
import { AiSecretService } from './ai-secret.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';

@Injectable()
export class AiProviderService {
  constructor(
    @InjectRepository(AiProviderEntity)
    private readonly repository: Repository<AiProviderEntity>,
    private readonly dataSource: DataSource,
    private readonly secrets: AiSecretService,
  ) {}
  async list(activeOnly = false): Promise<AiProvider[]> {
    const rows = await this.repository.find({
      where: activeOnly ? { isActive: true } : {},
      order: { isDefault: 'DESC', name: 'ASC' },
    });
    return rows.map((row) => this.toResponse(row));
  }
  async resolve(id?: string): Promise<AiProviderEntity> {
    const row = id
      ? await this.repository.findOne({ where: { id, isActive: true } })
      : await this.repository.findOne({
          where: { isDefault: true, isActive: true },
        });
    if (!row)
      throw new NotFoundException(
        id
          ? 'Provider AI không tồn tại hoặc đang tắt'
          : 'Chưa cấu hình provider AI mặc định',
      );
    return row;
  }
  async create(dto: CreateAiProviderDto): Promise<AiProvider> {
    return this.dataSource.transaction(async (manager) => {
      if (dto.isDefault)
        await manager.update(AiProviderEntity, {}, { isDefault: false });
      const entity = manager.create(AiProviderEntity, {
        ...dto,
        baseUrl: normalizeBaseUrl(dto.baseUrl),
        encryptedApiKey: dto.apiKey ? this.secrets.encrypt(dto.apiKey) : null,
        baseCreditCost: dto.baseCreditCost ?? 1,
        creditCostPer1kTokens: dto.creditCostPer1kTokens ?? 1,
      });
      return this.toResponse(await manager.save(entity));
    });
  }
  async update(id: string, dto: UpdateAiProviderDto): Promise<AiProvider> {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(AiProviderEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Provider AI không tồn tại');
      if (dto.isDefault)
        await manager.update(AiProviderEntity, {}, { isDefault: false });
      if (dto.name !== undefined) row.name = dto.name;
      if (dto.kind !== undefined) row.kind = dto.kind;
      if (dto.baseUrl !== undefined)
        row.baseUrl = normalizeBaseUrl(dto.baseUrl);
      if (dto.model !== undefined) row.model = dto.model;
      if (dto.apiKey !== undefined)
        row.encryptedApiKey = dto.apiKey
          ? this.secrets.encrypt(dto.apiKey)
          : null;
      if (dto.isActive !== undefined) row.isActive = dto.isActive;
      if (dto.isDefault !== undefined) row.isDefault = dto.isDefault;
      if (dto.baseCreditCost !== undefined)
        row.baseCreditCost = dto.baseCreditCost;
      if (dto.creditCostPer1kTokens !== undefined)
        row.creditCostPer1kTokens = dto.creditCostPer1kTokens;
      return this.toResponse(await manager.save(row));
    });
  }
  async remove(id: string): Promise<void> {
    const row = await this.repository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Provider AI không tồn tại');
    try {
      await this.repository.remove(row);
    } catch {
      throw new BadRequestException(
        'Provider đã có lịch sử sử dụng, hãy tắt thay vì xóa',
      );
    }
  }
  apiKey(row: AiProviderEntity): string | null {
    return this.secrets.decrypt(row.encryptedApiKey);
  }
  toResponse(row: AiProviderEntity): AiProvider {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      baseUrl: row.baseUrl,
      model: row.model,
      isActive: row.isActive,
      isDefault: row.isDefault,
      hasApiKey: Boolean(row.encryptedApiKey),
      baseCreditCost: row.baseCreditCost,
      creditCostPer1kTokens: row.creditCostPer1kTokens,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new BadRequestException('Base URL provider không hợp lệ');
  return value.replace(/\/+$/, '');
}
