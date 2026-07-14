import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { AiProviderKind } from './entities/ai-provider.entity';

@Injectable()
export class AiProviderUrlPolicyService {
  constructor(private readonly config: ConfigService) {}

  async assertAllowed(kind: AiProviderKind, rawUrl: string): Promise<void> {
    const url = new URL(rawUrl);
    const hostname = normalizeHostname(url.hostname);
    if (kind === AiProviderKind.OLLAMA) {
      const allowedHosts = csv(
        this.config.get<string>(
          'AI_OLLAMA_ALLOWED_HOSTS',
          'localhost,127.0.0.1,::1,host.docker.internal,ollama',
        ),
      );
      const allowedPorts = csv(
        this.config.get<string>('AI_OLLAMA_ALLOWED_PORTS', '11434'),
      );
      const port = url.port || (url.protocol === 'https:' ? '443' : '80');
      if (!allowedHosts.has(hostname) || !allowedPorts.has(port)) {
        throw new BadRequestException(
          'Ollama chỉ được phép gọi host/port đã cấu hình',
        );
      }
      return;
    }

    if (
      this.config.get<string>('NODE_ENV') === 'production' &&
      url.protocol !== 'https:'
    ) {
      throw new BadRequestException('Provider bên ngoài bắt buộc dùng HTTPS');
    }
    const explicitAllowlist = csv(
      this.config.get<string>('AI_PROVIDER_PRIVATE_HOST_ALLOWLIST', ''),
    );
    if (explicitAllowlist.has(hostname)) return;

    const addresses = isIP(hostname)
      ? [hostname]
      : (await lookup(hostname, { all: true, verbatim: true })).map(
          (entry) => entry.address,
        );
    if (
      !addresses.length ||
      addresses.some((address) => !isPublicIp(address))
    ) {
      throw new BadRequestException(
        'Provider bên ngoài không được trỏ vào mạng nội bộ hoặc địa chỉ đặc biệt',
      );
    }
  }
}

function csv(value: string): Set<string> {
  return new Set(
    value
      .split(',')
      .map((item) => normalizeHostname(item.trim()))
      .filter(Boolean),
  );
}

function normalizeHostname(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '');
}

function isPublicIp(value: string): boolean {
  try {
    let address = ipaddr.parse(value);
    if (address.kind() === 'ipv6') {
      const ipv6Address = address as ipaddr.IPv6;
      if (ipv6Address.isIPv4MappedAddress()) {
        address = ipv6Address.toIPv4Address();
      }
    }
    return address.range() === 'unicast';
  } catch {
    return false;
  }
}
