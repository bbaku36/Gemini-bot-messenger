import 'dotenv/config';
import * as express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

const server = express();
let isBootstrapped = false;

async function createNestServer() {
  if (!isBootstrapped) {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
    await app.init();
    isBootstrapped = true;
  }
  return server;
}

export default async function handler(req: any, res: any) {
  const s = await createNestServer();
  return s(req, res);
}

