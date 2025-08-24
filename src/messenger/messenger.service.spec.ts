import { Test, TestingModule } from '@nestjs/testing';
import { MessengerService } from './messenger.service';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai/ai.service';

describe('MessengerService', () => {
  let service: MessengerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessengerService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: AiService, useValue: { generateResponse: jest.fn() } },
      ],
    }).compile();

    service = module.get<MessengerService>(MessengerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});