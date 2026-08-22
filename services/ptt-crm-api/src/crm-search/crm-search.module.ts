import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CrmSearchController } from './crm-search.controller';
import { CrmSearchIndexerService } from './crm-search-indexer.service';
import { CrmSearchService } from './crm-search.service';
import { OpensearchClient } from './opensearch.client';
import { SearchDocumentProvider } from './search-document.provider';

@Module({
  imports: [ConfigModule, StaffAuthModule],
  controllers: [CrmSearchController],
  providers: [OpensearchClient, SearchDocumentProvider, CrmSearchService, CrmSearchIndexerService],
  exports: [CrmSearchService, CrmSearchIndexerService, OpensearchClient],
})
export class CrmSearchModule {}
