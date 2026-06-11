import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppService } from './app.service';

describe('AppModule', () => {
  it('compiles with the default photo source provider wiring', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef.get(AppService)).toBeInstanceOf(AppService);

    await moduleRef.close();
  });
});
