import { CatalogService, PRODUCTS } from '../services/catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    service = new CatalogService();
  });

  describe('getAllProducts', () => {
    it('should return all products', () => {
      const products = service.getAllProducts();

      expect(products).toBeDefined();
      expect(products.length).toBe(3);
      expect(products).toEqual(PRODUCTS);
    });

    it('should return array with correct structure', () => {
      const products = service.getAllProducts();

      products.forEach((product) => {
        expect(product.id).toBeDefined();
        expect(product.title).toBeDefined();
        expect(product.price).toBeDefined();
        expect(product.currency).toBe('RUB');
        expect(product.image).toBeDefined();
        expect(product.description).toBeDefined();
        expect(product.specs).toBeDefined();
        expect(product.rating).toBeDefined();
        expect(product.reviews).toBeDefined();
      });
    });
  });

  describe('getProductById', () => {
    it('should return product by valid id', () => {
      const product = service.getProductById('prod-1');

      expect(product).toBeDefined();
      expect(product?.id).toBe('prod-1');
      expect(product?.title).toBe('Двухкамерный холодильник NoFrost');
      expect(product?.price).toBe(45990);
    });

    it('should return second product', () => {
      const product = service.getProductById('prod-2');

      expect(product?.id).toBe('prod-2');
      expect(product?.title).toBe('Холодильник Side-by-Side с диспенсером');
      expect(product?.price).toBe(89990);
    });

    it('should return third product', () => {
      const product = service.getProductById('prod-3');

      expect(product?.id).toBe('prod-3');
      expect(product?.title).toBe('Компактный холодильник с нижней морозильной камерой');
      expect(product?.price).toBe(32490);
    });

    it('should return undefined for non-existent product', () => {
      const product = service.getProductById('nonexistent');

      expect(product).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const product = service.getProductById('');

      expect(product).toBeUndefined();
    });
  });

  describe('Product data integrity', () => {
    it('should have products with valid ratings', () => {
      const products = service.getAllProducts();

      products.forEach((product) => {
        expect(product.rating).toBeGreaterThanOrEqual(0);
        expect(product.rating).toBeLessThanOrEqual(5);
        expect(product.reviews).toBeGreaterThan(0);
      });
    });

    it('should have products with specs', () => {
      const products = service.getAllProducts();

      products.forEach((product) => {
        expect(product.specs.length).toBeGreaterThan(0);
        product.specs.forEach((spec) => {
          expect(spec.label).toBeDefined();
          expect(spec.value).toBeDefined();
        });
      });
    });
  });
});
