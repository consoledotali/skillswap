import prisma from '../config/db.js';

async function getCatalog(_req, res, next) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        skills: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true, category_id: true },
        },
      },
    });
    res.json({ categories });
  } catch (error) { next(error); }
}

export { getCatalog };
