const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../src/app");
const prisma = require("../src/prisma/client");

const API = "/api/v1";

async function login(email, password = "password123") {
  const res = await request(app).post(`${API}/auth/login`).send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.token;
}

describe("AUTH", () => {
  test("Register as participant → returns token", async () => {
    const email = `p_${Date.now()}@t.com`;
    const res = await request(app).post(`${API}/auth/register`).send({
      email,
      password: "password123",
      name: "Test User",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    const u = await prisma.user.findUnique({ where: { email } });
    expect(u.role).toBe("participant");
  });

  test("Login with correct credentials → returns token", async () => {
    const tok = await login("alice@participant.com");
    expect(tok).toBeTruthy();
  });

  test("Login with wrong password → 401", async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: "alice@participant.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  test("GET /auth/signup/brands sans auth → liste pour inscription", async () => {
    const res = await request(app).get(`${API}/auth/signup/brands`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const row = res.body.data.find((x) => x.name && typeof x.id === "number");
    expect(row).toBeTruthy();
  });

  test("Register role brand → compte Brand", async () => {
    const email = `brand_reg_${Date.now()}@t.com`;
    await request(app)
      .post(`${API}/auth/register`)
      .send({ email, password: "password123", name: "Nova Brand", role: "brand" })
      .expect(201);
    const u = await prisma.user.findUnique({ where: { email } });
    expect(u.role).toBe("brand");
    expect(await prisma.brand.findUnique({ where: { userId: u.id } })).not.toBeNull();
    await prisma.user.delete({ where: { id: u.id } });
  });

  test("Register quizmaster sans brandId → 400", async () => {
    const email = `qm_nr_${Date.now()}@t.com`;
    const res = await request(app)
      .post(`${API}/auth/register`)
      .send({ email, password: "password123", name: "X", role: "quizmaster" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/brandId/i);
  });

  test("Quizmaster inscription PENDING puis validation brand → accès quizzes", async () => {
    const brandEmail = `appr_br_${Date.now()}@t.com`;
    await request(app)
      .post(`${API}/auth/register`)
      .send({ email: brandEmail, password: "password123", name: "ApprBrand", role: "brand" })
      .expect(201);
    const brandUserAccount = await prisma.user.findUnique({ where: { email: brandEmail } });
    const bNew = await prisma.brand.findUnique({ where: { userId: brandUserAccount.id } });
    const brandTokSelf = await login(brandEmail);

    const nBefore = await prisma.notification.count({
      where: { userId: brandUserAccount.id, type: "quizmaster_pending_approval" },
    });

    const email = `qm_pen_${Date.now()}@t.com`;
    const reg = await request(app)
      .post(`${API}/auth/register`)
      .send({
        email,
        password: "password123",
        name: "Pending QM",
        role: "quizmaster",
        brandId: bNew.id,
      });
    expect(reg.status).toBe(201);
    expect(reg.body.data.user.quizmasterApprovalStatus).toBe("PENDING");
    expect(reg.body.data.user.role).toBe("quizmaster");
    const pendTok = reg.body.data.token;

    expect(
      await prisma.notification.count({
        where: { userId: brandUserAccount.id, type: "quizmaster_pending_approval" },
      }),
    ).toBe(nBefore + 1);

    await request(app)
      .get(`${API}/quizmaster/approval-status`)
      .set("Authorization", `Bearer ${pendTok}`)
      .expect(200);

    await request(app)
      .get(`${API}/quizmaster/quizzes`)
      .set("Authorization", `Bearer ${pendTok}`)
      .expect(403);

    await request(app)
      .get(`${API}/quizmaster/profile`)
      .set("Authorization", `Bearer ${pendTok}`)
      .expect(403);

    const pendUser = await prisma.user.findUnique({ where: { email } });
    const qmRow = await prisma.quizmaster.findUnique({ where: { userId: pendUser.id } });

    await request(app)
      .post(`${API}/brand/quizmasters/${qmRow.id}/approve`)
      .set("Authorization", `Bearer ${brandTokSelf}`)
      .expect(200);

    await prisma.quizmaster.update({
      where: { id: qmRow.id },
      data: {
        phoneE164: "+21670111299",
        gender: "prefer_not",
        birthDate: new Date("1990-01-10"),
        profilePhotoUrl: "https://placehold.co/140x140/png?text=QM",
        isProfileComplete: true,
      },
    });

    const linTok = await login(email);
    await request(app)
      .get(`${API}/quizmaster/quizzes`)
      .set("Authorization", `Bearer ${linTok}`)
      .expect(200);

    await prisma.user.delete({ where: { id: pendUser.id } });
    await prisma.user.delete({ where: { id: brandUserAccount.id } });
  });
});

describe("ADMIN", () => {
  let adminTok;

  beforeAll(async () => {
    adminTok = await login("admin@acadecom.com");
  });

  test("Blocage utilisateur → login possible ; API métier refusées (compte suspendu)", async () => {
    const email = `blocked_${Date.now()}@t.com`;
    await request(app).post(`${API}/auth/register`).send({
      email,
      password: "password123",
      name: "B",
    });
    const u = await prisma.user.findUnique({ where: { email } });
    await request(app).patch(`${API}/admin/users/${u.id}/block`).set("Authorization", `Bearer ${adminTok}`);
    const again = await prisma.user.findUnique({ where: { id: u.id } });
    expect(again.isBlocked).toBe(true);

    const loginRes = await request(app)
      .post(`${API}/auth/login`)
      .send({ email, password: "password123" });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.isBlocked).toBe(true);
    const tok = loginRes.body.data.token;

    const sess = await request(app)
      .get(`${API}/auth/session`)
      .set("Authorization", `Bearer ${tok}`);
    expect(sess.status).toBe(200);
    expect(sess.body.data.isBlocked).toBe(true);

    const forbidden = await request(app)
      .get(`${API}/participant/profile`)
      .set("Authorization", `Bearer ${tok}`);
    expect(forbidden.status).toBe(403);
    expect(String(forbidden.body.message)).toContain("Account is blocked");

    await request(app).post(`${API}/auth/logout`).set("Authorization", `Bearer ${tok}`).expect(200);
  });

  test("Delete a user → user removed from DB", async () => {
    const email = `del_${Date.now()}@t.com`;
    await request(app).post(`${API}/auth/register`).send({
      email,
      password: "password123",
      name: "Del",
    });
    const u = await prisma.user.findUnique({ where: { email } });
    await request(app).delete(`${API}/admin/users/${u.id}`).set("Authorization", `Bearer ${adminTok}`);
    const gone = await prisma.user.findUnique({ where: { id: u.id } });
    expect(gone).toBeNull();
  });
});

describe("BRAND", () => {
  let brandTok;
  let qmTok;
  let brandIdDb;

  beforeAll(async () => {
    brandTok = await login("ooredoo@brand.com");
    qmTok = await login("amir@ooredoo.com");
    const u = await prisma.user.findUnique({ where: { email: "ooredoo@brand.com" } });
    const b = await prisma.brand.findUnique({ where: { userId: u.id } });
    brandIdDb = b.id;
  });

  test("GET /brand/billing → overview + cycles", async () => {
    const res = await request(app)
      .get(`${API}/brand/billing`)
      .set("Authorization", `Bearer ${brandTok}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.cycles)).toBe(true);
    expect(res.body.data.overview).toMatchObject({
      effectivePlanType: "FREE",
    });
  });

  test("GET /brand/subscription → usage and limits", async () => {
    const res = await request(app)
      .get(`${API}/brand/subscription`)
      .set("Authorization", `Bearer ${brandTok}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      planType: "FREE",
      effectivePlanType: "FREE",
    });
    expect(typeof res.body.data.activeQuizzes).toBe("number");
    expect(typeof res.body.data.activeQuizmasters).toBe("number");
  });

  test("FREE pack — 6th active quiz activation rejected", async () => {
    const mk = (label) => ({
      title: `${label}_${Date.now()}`,
      isActive: false,
      questions: [
        {
          text: "Q?",
          xpReward: 5,
          options: [
            { text: "a", isCorrect: true },
            { text: "b", isCorrect: false },
          ],
        },
      ],
    });
    const r1 = await request(app)
      .post(`${API}/quizmaster/quizzes`)
      .set("Authorization", `Bearer ${qmTok}`)
      .send(mk("cap1"));
    const r2 = await request(app)
      .post(`${API}/quizmaster/quizzes`)
      .set("Authorization", `Bearer ${qmTok}`)
      .send(mk("cap2"));
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    const id1 = r1.body.data.id;
    const id2 = r2.body.data.id;

    await request(app)
      .post(`${API}/brand/quizzes/${id1}/activate`)
      .set("Authorization", `Bearer ${brandTok}`)
      .expect(200);

    const last = await request(app)
      .post(`${API}/brand/quizzes/${id2}/activate`)
      .set("Authorization", `Bearer ${brandTok}`);
    expect(last.status).toBe(403);

    await prisma.quiz.deleteMany({ where: { id: { in: [id1, id2] } } });
  });

  test("Activate a quiz → isActive becomes true", async () => {
    const res = await request(app)
      .post(`${API}/quizmaster/quizzes`)
      .set("Authorization", `Bearer ${qmTok}`)
      .send({
        title: `Inactive ${Date.now()}`,
        isActive: false,
        questions: [
          {
            text: "Q1?",
            xpReward: 20,
            options: [
              { text: "a", isCorrect: true },
              { text: "b", isCorrect: false },
            ],
          },
        ],
      });
    expect(res.status).toBe(201);
    const quizId = res.body.data.id;
    await prisma.quiz.update({ where: { id: quizId }, data: { isActive: false } });

    const act = await request(app)
      .post(`${API}/brand/quizzes/${quizId}/activate`)
      .set("Authorization", `Bearer ${brandTok}`);
    expect(act.status).toBe(200);
    const q = await prisma.quiz.findUnique({ where: { id: quizId } });
    expect(q.isActive).toBe(true);
  });

  test("Deactivate a quiz → isActive becomes false", async () => {
    const res = await request(app)
      .post(`${API}/quizmaster/quizzes`)
      .set("Authorization", `Bearer ${qmTok}`)
      .send({
        title: `ToDeactivate ${Date.now()}`,
        isActive: false,
        questions: [
          {
            text: "Qt?",
            xpReward: 5,
            options: [
              { text: "a", isCorrect: true },
              { text: "b", isCorrect: false },
            ],
          },
        ],
      });
    expect(res.status).toBe(201);
    const quizId = res.body.data.id;
    await prisma.quiz.update({ where: { id: quizId }, data: { isActive: true } });

    await request(app)
      .post(`${API}/brand/quizzes/${quizId}/deactivate`)
      .set("Authorization", `Bearer ${brandTok}`)
      .expect(200);

    const q = await prisma.quiz.findUnique({ where: { id: quizId } });
    expect(q.isActive).toBe(false);
  });

  test("Brand routes with invalid id → 400", async () => {
    await request(app)
      .post(`${API}/brand/quizmasters/not-a-number/unblock`)
      .set("Authorization", `Bearer ${brandTok}`)
      .expect(400);

    await request(app)
      .post(`${API}/brand/quizzes/xyz/activate`)
      .set("Authorization", `Bearer ${brandTok}`)
      .expect(400);
  });

  test("Brand blocks quizmaster → user blocked and their quizzes deactivated", async () => {
    const hashed = await bcrypt.hash("password123", 10);
    const brand = await prisma.brand.findUnique({ where: { id: brandIdDb } });
    const u = await prisma.user.create({
      data: {
        email: `qm_block_${Date.now()}@t.com`,
        password: hashed,
        name: "BlockMeQM",
        isBlocked: true,
        role: "quizmaster",
        quizmaster: {
          create: { brandId: brand.id, approvalStatus: "ACTIVE" },
        },
      },
      include: { quizmaster: true },
    });
    const qz = await prisma.quiz.create({
      data: {
        brandId: brand.id,
        quizmasterId: u.quizmaster.id,
        title: "Active before block",
        isActive: true,
      },
    });

    await request(app)
      .post(`${API}/brand/quizmasters/${u.quizmaster.id}/block`)
      .set("Authorization", `Bearer ${brandTok}`)
      .expect(200);

    const userAfter = await prisma.user.findUnique({ where: { id: u.id } });
    expect(userAfter.isBlocked).toBe(true);
    const quizAfter = await prisma.quiz.findUnique({ where: { id: qz.id } });
    expect(quizAfter.isActive).toBe(false);
  });

  test("Brand unblocks quizmaster → user active; quizzes stay inactive until activated", async () => {
    const sana = await prisma.user.findUnique({ where: { email: "sana@ooredoo.com" } });
    await prisma.user.update({ where: { id: sana.id }, data: { isBlocked: true } });

    const hashed = await bcrypt.hash("password123", 10);
    const brand = await prisma.brand.findUnique({ where: { id: brandIdDb } });
    try {
      const u = await prisma.user.create({
        data: {
          email: `qm_unblk_${Date.now()}@t.com`,
          password: hashed,
          name: "UnblockQM",
          role: "quizmaster",
          isBlocked: true,
          quizmaster: {
            create: { brandId: brand.id, approvalStatus: "ACTIVE" },
          },
        },
        include: { quizmaster: true },
      });
      const qz = await prisma.quiz.create({
        data: {
          brandId: brand.id,
          quizmasterId: u.quizmaster.id,
          title: "Off while QM blocked",
          isActive: false,
        },
      });

      await request(app)
        .post(`${API}/brand/quizmasters/${u.quizmaster.id}/unblock`)
        .set("Authorization", `Bearer ${brandTok}`)
        .expect(200);

      const userAfter = await prisma.user.findUnique({ where: { id: u.id } });
      expect(userAfter.isBlocked).toBe(false);
      const quizAfter = await prisma.quiz.findUnique({ where: { id: qz.id } });
      expect(quizAfter.isActive).toBe(false);
      await prisma.user.delete({ where: { id: u.id } });
    } finally {
      await prisma.user.update({ where: { id: sana.id }, data: { isBlocked: false } });
    }
  });

  test("Delete quizmaster → their quizzes are also deleted", async () => {
    const hashed = await bcrypt.hash("password123", 10);
    const brand = await prisma.brand.findUnique({ where: { id: brandIdDb } });
    const u = await prisma.user.create({
      data: {
        email: `qm_kill_${Date.now()}@t.com`,
        password: hashed,
        name: "KillMe",
        role: "quizmaster",
        quizmaster: {
          create: { brandId: brand.id, approvalStatus: "ACTIVE" },
        },
      },
      include: { quizmaster: true },
    });

    await prisma.quiz.create({
      data: {
        brandId: brand.id,
        quizmasterId: u.quizmaster.id,
        title: "Temp quiz cascade",
        isActive: false,
      },
    });

    await request(app)
      .delete(`${API}/brand/quizmasters/${u.quizmaster.id}`)
      .set("Authorization", `Bearer ${brandTok}`);

    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
    const qs = await prisma.quiz.findMany({
      where: { quizmasterId: u.quizmaster.id },
    });
    expect(qs.length).toBe(0);
  });

  test("Brand creates product with coupon price → listed in participant store API", async () => {
    const name = `ProdBrand_${Date.now()}`;
    const desc = "Description affichée côté participant.";
    const cre = await request(app)
      .post(`${API}/brand/products`)
      .set("Authorization", `Bearer ${brandTok}`)
      .field("name", name)
      .field("couponPrice", "42")
      .field("stock", "5")
      .field("description", desc);
    expect(cre.status).toBe(201);
    expect(cre.body.data.couponPrice).toBe(42);
    expect(cre.body.data.description).toBe(desc);

    const list = await request(app).get(`${API}/store/products`);
    expect(list.status).toBe(200);
    const item = list.body.data.products.find((p) => p.name === name);
    expect(item).toBeTruthy();
    expect(item.couponPrice).toBe(42);
    expect(item.description).toBe(desc);

    await request(app)
      .delete(`${API}/brand/products/${cre.body.data.id}`)
      .set("Authorization", `Bearer ${brandTok}`)
      .expect(200);

    expect(await prisma.product.findUnique({ where: { id: cre.body.data.id } })).toBeNull();
  });

  test("Brand create product with invalid coupon price → 400", async () => {
    await request(app)
      .post(`${API}/brand/products`)
      .set("Authorization", `Bearer ${brandTok}`)
      .field("name", "Invalide")
      .field("couponPrice", "0")
      .field("stock", "1")
      .expect(400);
  });

  test("Brand creates product with image upload → image path stored", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const name = `ImgProd_${Date.now()}`;
    const cre = await request(app)
      .post(`${API}/brand/products`)
      .set("Authorization", `Bearer ${brandTok}`)
      .field("name", name)
      .field("couponPrice", "6")
      .field("stock", "1")
      .attach("image", png, "tiny.png");
    expect(cre.status).toBe(201);
    expect(cre.body.data.image).toMatch(/^\/uploads\/products\//);

    await request(app)
      .delete(`${API}/brand/products/${cre.body.data.id}`)
      .set("Authorization", `Bearer ${brandTok}`)
      .expect(200);
  });

  test("Brand updates product → fields persisted", async () => {
    const base = `EditProd_${Date.now()}`;
    const cre = await request(app)
      .post(`${API}/brand/products`)
      .set("Authorization", `Bearer ${brandTok}`)
      .field("name", base)
      .field("couponPrice", "10")
      .field("stock", "3")
      .field("description", "Avant")
      .field("isActive", "true");
    expect(cre.status).toBe(201);
    const pid = cre.body.data.id;

    const upd = await request(app)
      .put(`${API}/brand/products/${pid}`)
      .set("Authorization", `Bearer ${brandTok}`)
      .field("name", `${base}_OK`)
      .field("couponPrice", "77")
      .field("stock", "9")
      .field("description", "Après")
      .field("isActive", "false");
    expect(upd.status).toBe(200);

    const row = await prisma.product.findUnique({ where: { id: pid } });
    expect(row.name).toBe(`${base}_OK`);
    expect(row.couponPrice).toBe(77);
    expect(row.stock).toBe(9);
    expect(row.description).toBe("Après");
    expect(row.isActive).toBe(false);

    await request(app)
      .delete(`${API}/brand/products/${pid}`)
      .set("Authorization", `Bearer ${brandTok}`)
      .expect(200);
  });
});

describe("QUIZMASTER", () => {
  let qmTok;

  beforeAll(async () => {
    qmTok = await login("mehdi@orange.com");
  });

  test("Quizmaster with incomplete profile can read profile but cannot list quizzes", async () => {
    const uRow = await prisma.user.findUnique({
      where: { email: "mehdi@orange.com" },
      include: { quizmaster: true },
    });
    const qmId = uRow.quizmaster.id;

    await prisma.quizmaster.update({
      where: { id: qmId },
      data: {
        phoneE164: null,
        profilePhotoUrl: null,
        isProfileComplete: false,
      },
    });

    try {
      const incompleteTok = await login("mehdi@orange.com");
      const prof = await request(app)
        .get(`${API}/quizmaster/profile`)
        .set("Authorization", `Bearer ${incompleteTok}`);
      expect(prof.status).toBe(200);

      const list = await request(app)
        .get(`${API}/quizmaster/quizzes`)
        .set("Authorization", `Bearer ${incompleteTok}`);
      expect(list.status).toBe(403);

      const create = await request(app)
        .post(`${API}/quizmaster/quizzes`)
        .set("Authorization", `Bearer ${incompleteTok}`)
        .send({ title: "X", questions: [] });
      expect(create.status).toBe(403);

      const tinyJpeg = Buffer.from(
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEBUQEBAVFhUXFRUYFRgYFRUYFRUWFRUWFRUWFRUYHSggGBslGxUVIjEhJSkrLi4vFx8zODMtNygtLisBCgoKDg0OGhAQGisfHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKAAoAMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAAEBQIDBgAB/8QANRAAAgEDAwIEBAQGAgMAAAAAAQIDAAQRBRIhMUEGE1FhInGBkTKhsfAUQsHR4fAVI0L/xAAZAQADAQEBAAAAAAAAAAAAAAABAgMABAX/xAAhEQACAgIDAQEBAQEAAAAAAAAAAQIREiExQQNRE2Ei/9oADAMBAAIRAxEAPwD7gAAAA//Z",
        "base64",
      );
      const patch = await request(app)
        .patch(`${API}/quizmaster/profile`)
        .set("Authorization", `Bearer ${incompleteTok}`)
        .field("name", "Mehdi")
        .field("email", "mehdi@orange.com")
        .field("phoneE164", "+21670111229")
        .field("gender", "prefer_not")
        .field("birthDate", "1990-01-10")
        .attach("photo", tinyJpeg, { filename: "p.jpg", contentType: "image/jpeg" });
      expect(patch.status).toBe(200);
      expect(patch.body.data.isProfileComplete).toBe(true);

      const listAfter = await request(app)
        .get(`${API}/quizmaster/quizzes`)
        .set("Authorization", `Bearer ${incompleteTok}`);
      expect(listAfter.status).toBe(200);
    } finally {
      await prisma.quizmaster.update({
        where: { id: qmId },
        data: {
          phoneE164: "+21670111223",
          gender: "prefer_not",
          birthDate: new Date("1990-01-10"),
          profilePhotoUrl: "https://placehold.co/140x140/png?text=QM",
          isProfileComplete: true,
        },
      });
      qmTok = await login("mehdi@orange.com");
    }
  });

  test("Create quiz with questions and options → quiz exists", async () => {
    const res = await request(app)
      .post(`${API}/quizmaster/quizzes`)
      .set("Authorization", `Bearer ${qmTok}`)
      .send({
        title: `Full quiz ${Date.now()}`,
        questions: [
          {
            text: "Une question ?",
            xpReward: 25,
            options: [
              { text: "oui", isCorrect: true },
              { text: "non", isCorrect: false },
            ],
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.questions?.length ?? 1).toBeTruthy();
    const q = await prisma.quiz.findUnique({
      where: { id: res.body.data.id },
      include: { questions: { include: { options: true } } },
    });
    expect(q.questions.length).toBeGreaterThanOrEqual(1);
  });

  test("Delete quiz → questions and options cascade", async () => {
    const cre = await request(app)
      .post(`${API}/quizmaster/quizzes`)
      .set("Authorization", `Bearer ${qmTok}`)
      .send({
        title: `DelQuiz ${Date.now()}`,
        questions: [
          {
            text: "Q?",
            options: [
              { text: "A", isCorrect: true },
              { text: "B", isCorrect: false },
            ],
          },
        ],
      });
    const quizId = cre.body.data.id;
    const qsBefore = await prisma.question.findMany({ where: { quizId } });

    await request(app).delete(`${API}/quizmaster/quizzes/${quizId}`).set("Authorization", `Bearer ${qmTok}`);

    expect(await prisma.quiz.findUnique({ where: { id: quizId } })).toBeNull();
    const qsAfter = await prisma.question.findMany({ where: { id: { in: qsBefore.map((x) => x.id) } } });
    expect(qsAfter.length).toBe(0);
  });
});

describe("GAME", () => {
  let partTok;

  beforeAll(async () => {
    partTok = await login("bob@participant.com");
  });

  async function answersForQuiz(quizId) {
    const full = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });
    return full.questions.map((qr) => ({
      questionId: qr.id,
      selectedOptionIds: qr.options.filter((o) => o.isCorrect).map((o) => o.id),
    }));
  }

  test("Participant plays quiz → GameSession with correct xp and coupons", async () => {
    const brand = await prisma.brand.findFirst();
    const qm = await prisma.quizmaster.findFirst({ where: { brandId: brand.id } });
    const quiz = await prisma.quiz.create({
      data: {
        brandId: brand.id,
        quizmasterId: qm.id,
        title: `Quiz jeu test ${Date.now()}`,
        isActive: true,
        maxCoupons: 10,
        passingScore: 0.6,
        durationSeconds: 300,
        questions: {
          create: [
            {
              text: "Q1 test",
              xpReward: 20,
              options: {
                create: [
                  { text: "correct", isCorrect: true },
                  { text: "wrong", isCorrect: false },
                ],
              },
            },
            {
              text: "Q2 test",
              xpReward: 30,
              options: {
                create: [{ text: "ok", isCorrect: true }],
              },
            },
          ],
        },
      },
    });

    const p = await prisma.participant.findFirst({
      where: { user: { email: "bob@participant.com" } },
    });
    const answers = await answersForQuiz(quiz.id);

    await request(app)
      .post(`${API}/participant/quizzes/${quiz.id}/start`)
      .set("Authorization", `Bearer ${partTok}`)
      .expect(200);

    const beforeXp = p.xp;
    const beforeC = p.coupons;

    const res = await request(app)
      .post(`${API}/participant/quiz/${quiz.id}/play`)
      .set("Authorization", `Bearer ${partTok}`)
      .send({ answers });

    expect(res.status).toBe(201);
    expect(res.body.data.scorePercent).toBeCloseTo(1, 5);
    expect(res.body.data.passed).toBe(true);
    expect(res.body.data.xpEarned).toBe(50);

    const session = await prisma.gameSession.findUnique({
      where: { id: res.body.data.sessionId },
    });

    expect(session.couponsEarned).toBe(quiz.maxCoupons);

    const refreshed = await prisma.participant.findUnique({
      where: { id: p.id },
    });
    expect(refreshed.xp - beforeXp).toBe(res.body.data.xpEarned);
    expect(refreshed.coupons - beforeC).toBe(res.body.data.couponsEarned);
  });

  test("Participant below passing threshold → no coupons but XP on fully correct questions", async () => {
    const aliceTok = await login("alice@participant.com");
    const brand = await prisma.brand.findFirst();
    const qm = await prisma.quizmaster.findFirst({ where: { brandId: brand.id } });
    const quiz = await prisma.quiz.create({
      data: {
        brandId: brand.id,
        quizmasterId: qm.id,
        title: `Quiz seuil ${Date.now()}`,
        isActive: true,
        maxCoupons: 8,
        passingScore: 1,
        durationSeconds: 120,
        questions: {
          create: [
            {
              text: "Q1",
              xpReward: 10,
              options: {
                create: [
                  { text: "a ok", isCorrect: true },
                  { text: "b", isCorrect: false },
                ],
              },
            },
            {
              text: "Q2",
              xpReward: 20,
              options: {
                create: [
                  { text: "x ok", isCorrect: true },
                  { text: "y", isCorrect: false },
                ],
              },
            },
          ],
        },
      },
      include: { questions: { include: { options: true } } },
    });

    const sortedQs = [...quiz.questions].sort((a, b) => a.id - b.id);
    const q1 = sortedQs[0];
    const q2 = sortedQs[1];
    const wrongQ2 = q2.options.find((o) => !o.isCorrect);

    const answers = [
      {
        questionId: q1.id,
        selectedOptionIds: q1.options.filter((o) => o.isCorrect).map((o) => o.id),
      },
      {
        questionId: q2.id,
        selectedOptionIds: [wrongQ2.id],
      },
    ];

    const p = await prisma.participant.findFirst({
      where: { user: { email: "alice@participant.com" } },
    });
    const before = { xp: p.xp, coupons: p.coupons };

    await request(app)
      .post(`${API}/participant/quizzes/${quiz.id}/start`)
      .set("Authorization", `Bearer ${aliceTok}`)
      .expect(200);

    const res = await request(app)
      .post(`${API}/participant/quiz/${quiz.id}/play`)
      .set("Authorization", `Bearer ${aliceTok}`)
      .send({ answers });

    expect(res.status).toBe(201);
    expect(res.body.data.passed).toBe(false);
    expect(res.body.data.couponsEarned).toBe(0);
    expect(res.body.data.scorePercent).toBeCloseTo(0.5, 5);
    expect(res.body.data.xpEarned).toBe(10);

    const refreshed = await prisma.participant.findUnique({ where: { id: p.id } });
    expect(refreshed.xp - before.xp).toBe(10);
    expect(refreshed.coupons - before.coupons).toBe(0);

    await prisma.quiz.delete({ where: { id: quiz.id } });
  });

  test("Play same quiz twice → 409", async () => {
    const brand = await prisma.brand.findFirst();
    const qm = await prisma.quizmaster.findFirst({ where: { brandId: brand.id } });
    const quiz = await prisma.quiz.create({
      data: {
        brandId: brand.id,
        quizmasterId: qm.id,
        title: `Quiz double ${Date.now()}`,
        isActive: true,
        maxCoupons: 10,
        questions: {
          create: [
            {
              text: "One Q",
              xpReward: 10,
              options: {
                create: [{ text: "oui", isCorrect: true }],
              },
            },
          ],
        },
      },
    });

    const answers = await answersForQuiz(quiz.id);

    await request(app)
      .post(`${API}/participant/quizzes/${quiz.id}/start`)
      .set("Authorization", `Bearer ${partTok}`)
      .expect(200);

    await request(app)
      .post(`${API}/participant/quiz/${quiz.id}/play`)
      .set("Authorization", `Bearer ${partTok}`)
      .send({ answers });

    const res2 = await request(app)
      .post(`${API}/participant/quiz/${quiz.id}/play`)
      .set("Authorization", `Bearer ${partTok}`)
      .send({ answers });

    expect(res2.status).toBe(409);
  });
});

describe("PARTICIPANT_QUIZ_CATALOG", () => {
  let aliceTok;

  beforeAll(async () => {
    aliceTok = await login("alice@participant.com");
  });

  test("GET /participant/quizzes returns quizzes with isActive, brand, hasAttempted", async () => {
    const res = await request(app).get(`${API}/participant/quizzes`).set("Authorization", `Bearer ${aliceTok}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const row = res.body.data.find((q) => q.brand?.user?.name);
    expect(row).toBeTruthy();
    expect(typeof row.isActive).toBe("boolean");
    expect(typeof row.hasAttempted).toBe("boolean");
  });

  test("POST start reserves attempt; GET play 403 without start; second start idempotent", async () => {
    const brand = await prisma.brand.findFirst();
    const qm = await prisma.quizmaster.findFirst({ where: { brandId: brand.id } });
    const quiz = await prisma.quiz.create({
      data: {
        brandId: brand.id,
        quizmasterId: qm.id,
        title: `Start gate ${Date.now()}`,
        isActive: true,
        questions: {
          create: [
            {
              text: "Only",
              xpReward: 10,
              options: {
                create: [
                  { text: "a", isCorrect: true },
                  { text: "b", isCorrect: false },
                ],
              },
            },
          ],
        },
      },
    });

    const noStart = await request(app)
      .get(`${API}/participant/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${aliceTok}`);
    expect(noStart.status).toBe(403);

    const st = await request(app)
      .post(`${API}/participant/quizzes/${quiz.id}/start`)
      .set("Authorization", `Bearer ${aliceTok}`);
    expect(st.status).toBe(200);
    expect(st.body.data.started === true || st.body.data.alreadyStarted === true).toBe(true);

    const list = await request(app).get(`${API}/participant/quizzes`).set("Authorization", `Bearer ${aliceTok}`);
    const row = list.body.data.find((q) => q.id === quiz.id);
    expect(row?.hasAttempted).toBe(true);

    const st2 = await request(app)
      .post(`${API}/participant/quizzes/${quiz.id}/start`)
      .set("Authorization", `Bearer ${aliceTok}`);
    expect(st2.status).toBe(200);
    expect(st2.body.data.alreadyStarted).toBe(true);

    const ok = await request(app)
      .get(`${API}/participant/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${aliceTok}`);
    expect(ok.status).toBe(200);

    await prisma.quiz.delete({ where: { id: quiz.id } });
  });

  test("Pre-questions gate then main quiz play payload", async () => {
    const qmTok = await login("mehdi@orange.com");
    const createRes = await request(app)
      .post(`${API}/quizmaster/quizzes`)
      .set("Authorization", `Bearer ${qmTok}`)
      .send({
        title: `PreQ ${Date.now()}`,
        isActive: true,
        hasPreQuestions: true,
        preQuestions: [{ questionText: "Pourquoi participez-vous ?" }],
        questions: [
          {
            text: "Q principale ?",
            xpReward: 10,
            options: [
              { text: "a", isCorrect: true },
              { text: "b", isCorrect: false },
            ],
          },
        ],
      });
    expect(createRes.status).toBe(201);
    const quizId = createRes.body.data.id;
    const preId = createRes.body.data.preQuestions[0].id;
    const mainQ = createRes.body.data.questions[0];
    const correctOptId = mainQ.options.find((o) => o.isCorrect).id;

    await request(app)
      .post(`${API}/participant/quizzes/${quizId}/start`)
      .set("Authorization", `Bearer ${aliceTok}`)
      .expect(200);

    const g1 = await request(app)
      .get(`${API}/participant/quizzes/${quizId}`)
      .set("Authorization", `Bearer ${aliceTok}`);
    expect(g1.status).toBe(200);
    expect(g1.body.data.playPhase).toBe("preQuestions");
    expect(g1.body.data.questions.length).toBe(0);
    expect(g1.body.data.preQuestions?.length).toBe(1);

    const playBlocked = await request(app)
      .post(`${API}/participant/quiz/${quizId}/play`)
      .set("Authorization", `Bearer ${aliceTok}`)
      .send({
        answers: [{ questionId: mainQ.id, selectedOptionIds: [correctOptId] }],
      });
    expect(playBlocked.status).toBe(403);

    const preOk = await request(app)
      .post(`${API}/participant/quiz/${quizId}/pre-answers`)
      .set("Authorization", `Bearer ${aliceTok}`)
      .send({
        answers: [{ preQuestionId: preId, answerText: "Pour apprendre." }],
      });
    expect(preOk.status).toBe(200);

    const g2 = await request(app)
      .get(`${API}/participant/quizzes/${quizId}`)
      .set("Authorization", `Bearer ${aliceTok}`);
    expect(g2.status).toBe(200);
    expect(g2.body.data.playPhase).toBe("main");
    expect(g2.body.data.questions.length).toBe(1);

    await prisma.quiz.delete({ where: { id: quizId } });
  });

  test("GET play payload rejected when quiz inactive", async () => {
    const brand = await prisma.brand.findFirst();
    const qm = await prisma.quizmaster.findFirst({ where: { brandId: brand.id } });
    const quiz = await prisma.quiz.create({
      data: {
        brandId: brand.id,
        quizmasterId: qm.id,
        title: `Inactive GET ${Date.now()}`,
        isActive: false,
        questions: {
          create: [
            {
              text: "X",
              xpReward: 10,
              options: {
                create: [
                  { text: "a", isCorrect: true },
                  { text: "b", isCorrect: false },
                ],
              },
            },
          ],
        },
      },
    });
    const res = await request(app)
      .get(`${API}/participant/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${aliceTok}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/inactif/i);
    await prisma.quiz.delete({ where: { id: quiz.id } });
  });

  test("POST play rejected when quiz inactive", async () => {
    const brand = await prisma.brand.findFirst();
    const qm = await prisma.quizmaster.findFirst({ where: { brandId: brand.id } });
    const quiz = await prisma.quiz.create({
      data: {
        brandId: brand.id,
        quizmasterId: qm.id,
        title: `Inactive POST ${Date.now()}`,
        isActive: false,
        questions: {
          create: [
            {
              text: "Y",
              xpReward: 10,
              options: {
                create: [
                  { text: "a", isCorrect: true },
                  { text: "b", isCorrect: false },
                ],
              },
            },
          ],
        },
      },
      include: { questions: { include: { options: true } } },
    });
    const correctOpt = quiz.questions[0].options.find((o) => o.isCorrect);
    const tok = await login("sara@participant.com");
    const res = await request(app)
      .post(`${API}/participant/quiz/${quiz.id}/play`)
      .set("Authorization", `Bearer ${tok}`)
      .send({
        answers: [{ questionId: quiz.questions[0].id, selectedOptionIds: [correctOpt.id] }],
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/inactif/i);
    await prisma.quiz.delete({ where: { id: quiz.id } });
  });

  test("Quiz start forbidden when participant profile incomplete", async () => {
    const email = `inc_pf_${Date.now()}@quiz.com`;
    await request(app)
      .post(`${API}/auth/register`)
      .send({ email, password: "password123", name: "Incomplete" })
      .expect(201);

    const tok = await login(email, "password123");
    const brand = await prisma.brand.findFirst();
    const qm = await prisma.quizmaster.findFirst({ where: { brandId: brand.id } });
    const quiz = await prisma.quiz.create({
      data: {
        brandId: brand.id,
        quizmasterId: qm.id,
        title: `Gate ${Date.now()}`,
        isActive: true,
        questions: {
          create: [
            {
              text: "Une",
              xpReward: 5,
              options: { create: [{ text: "o", isCorrect: true }] },
            },
          ],
        },
      },
    });

    const res = await request(app)
      .get(`${API}/participant/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${tok}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Profil incomplet/i);
    await prisma.quiz.delete({ where: { id: quiz.id } });
  });

  test("Participant change-password validates current password then accepts new", async () => {
    const email = `pwd_${Date.now()}@quiz.com`;
    await request(app).post(`${API}/auth/register`).send({ email, password: "aaaaaaaa", name: "Pwd" }).expect(201);
    const tok = await login(email, "aaaaaaaa");

    const bad = await request(app)
      .put(`${API}/profile/change-password`)
      .set("Authorization", `Bearer ${tok}`)
      .send({ currentPassword: "wrong", newPassword: "bbbbbbbb" });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .put(`${API}/profile/change-password`)
      .set("Authorization", `Bearer ${tok}`)
      .send({ currentPassword: "aaaaaaaa", newPassword: "cccccccc" });
    expect(ok.status).toBe(200);

    const tok2 = await login(email, "cccccccc");
    expect(tok2).toBeTruthy();
  });
});

describe("STORE", () => {
  let partTok;

  beforeAll(async () => {
    partTok = await login("sara@participant.com");
  });

  test("Participant buys product with enough coupons → order created, coupons deducted", async () => {
    const alice = await prisma.user.findUnique({ where: { email: "alice@participant.com" } });
    await prisma.participant.update({
      where: { userId: alice.id },
      data: { coupons: 999 },
    });
    const tokAlice = await login("alice@participant.com");

    const product = await prisma.product.findFirst({ where: { name: "Recharge 5DT" } });

    const before = await prisma.participant.findFirst({
      where: { user: { email: "alice@participant.com" } },
    });

    const res = await request(app)
      .post(`${API}/store/orders`)
      .set("Authorization", `Bearer ${tokAlice}`)
      .send({
        items: [{ productId: product.id, quantity: 1 }],
      });

    expect(res.status).toBe(201);
    const after = await prisma.participant.findFirst({
      where: { user: { email: "alice@participant.com" } },
    });
    expect(after.coupons).toBe(before.coupons - product.couponPrice);
    expect(await prisma.order.findUnique({ where: { id: res.body.data.id } })).not.toBeNull();
  });

  test("Buy with insufficient coupons → 400", async () => {
    const u = await prisma.user.findUnique({ where: { email: "sara@participant.com" } });
    await prisma.participant.update({
      where: { userId: u.id },
      data: { coupons: 1 },
    });
    const prod = await prisma.product.findFirst({ where: { couponPrice: { gte: 5 } } });
    const res = await request(app)
      .post(`${API}/store/orders`)
      .set("Authorization", `Bearer ${partTok}`)
      .send({
        items: [{ productId: prod.id, quantity: 1 }],
      });

    expect(res.status).toBe(400);
  });
});

describe("LEADERBOARD", () => {
  test("GET /leaderboard → top 20 sorted by xp DESC", async () => {
    const res = await request(app).get(`${API}/leaderboard`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(20);
    for (let i = 1; i < res.body.data.length; i += 1) {
      expect(res.body.data[i - 1].xp).toBeGreaterThanOrEqual(res.body.data[i].xp);
    }
  });
});
