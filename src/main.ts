import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const appMode = process.env.APP_MODE;

  if (appMode === 'WORKER') {
    // Worker Mode: No HTTP Server, just Application Context
    const app = await NestFactory.createApplicationContext(AppModule);
    app.enableShutdownHooks(); // Important for Graceful Shutdown
    console.log('Worker is running...');
    // The process will stay alive because of the SQS Consumer's polling loop
  } else {
    // API Mode (default): Start HTTP Server
    const app = await NestFactory.create(AppModule);
    app.enableShutdownHooks();

    const config = new DocumentBuilder()
      .setTitle('Orders Production Manager')
      .setDescription('The Orders Production Manager API description')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    await app.listen(process.env.PORT ?? 8080);
    console.log(`API is running on port ${process.env.PORT ?? 8080}`);
  }
}
bootstrap();
