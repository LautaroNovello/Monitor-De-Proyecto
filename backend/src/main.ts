import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefijo global para todos los endpoints
  app.setGlobalPrefix('api');

  // CORS abierto: el acceso está controlado por la red Docker y/o el firewall del host
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Escuchar en todas las interfaces para que Docker pueda enrutar el tráfico
  await app.listen(3001, '0.0.0.0');
}
bootstrap();
