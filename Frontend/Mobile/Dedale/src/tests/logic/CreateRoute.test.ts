import { reorderList } from '../../screens/CreateRoute';

describe('Logic: CreateRoute Reordering', () => {
  test('Déplace un élément du début vers la fin', () => {
    // ARRANGE
    const list = ['A', 'B', 'C', 'D'];
    
    // ACT
    const result = reorderList(list, 0, 2);

    // ASSERT
    expect(result).toEqual(['B', 'C', 'A', 'D']);
  });

  test('Déplace un élément de la fin vers le début', () => {
    // ARRANGE
    const list = [1, 2, 3, 4];

    // ACT
    const result = reorderList(list, 3, 1);

    // ASSERT
    expect(result).toEqual([1, 4, 2, 3]);
  });
});