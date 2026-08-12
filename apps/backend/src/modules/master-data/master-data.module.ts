import { Module, Global } from "@nestjs/common";
import { MasterDependencyRegistry } from "./master-dependency.registry";
import { DepartmentsModule } from "./departments/departments.module";
import { DesignationsModule } from "./designations/designations.module";
import { UnitsModule } from "./units/units.module";
import { CategoriesModule } from "./categories/categories.module";
import { TaxCategoriesModule } from "./tax-categories/tax-categories.module";
import { WarehousesModule } from "./warehouses/warehouses.module";

@Global()
@Module({
  imports: [
    DepartmentsModule,
    DesignationsModule,
    UnitsModule,
    CategoriesModule,
    TaxCategoriesModule,
    WarehousesModule,
  ],
  providers: [MasterDependencyRegistry],
  exports: [
    MasterDependencyRegistry,
    DepartmentsModule,
    DesignationsModule,
    UnitsModule,
    CategoriesModule,
    TaxCategoriesModule,
    WarehousesModule,
  ],
})
export class MasterDataModule {}
