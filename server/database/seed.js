import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "../src/config/db.js";

async function main() {
  const passwordHash = await bcrypt.hash("Test@123", 10);

  const categories = [
    { name: "IT", description: "Programming and technology skills" },
    { name: "Design", description: "Creative and visual design skills" },
    { name: "Languages", description: "Language learning and communication" },
    { name: "Music", description: "Music and performance skills" },
    { name: "Cooking", description: "Cooking and culinary skills" },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: category,
      create: category,
    });
  }

  const skills = [
    ["JavaScript", "IT"],
    ["React.js", "IT"],
    ["Python Programming", "IT"],
    ["Web Development", "IT"],
    ["UI/UX Design", "Design"],
    ["Graphic Design", "Design"],
    ["Video Editing", "Design"],
    ["English Language", "Languages"],
    ["Urdu Language", "Languages"],
    ["Guitar", "Music"],
    ["Cooking", "Cooking"],
  ];

  for (const [name, categoryName] of skills) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { name: categoryName },
    });
    await prisma.skill.upsert({
      where: { name },
      update: { category_id: category.id },
      create: { name, category_id: category.id },
    });
  }

  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.report.deleteMany();
  await prisma.swapRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.profileView.deleteMany();
  await prisma.userSkill.deleteMany();
  await prisma.refreshToken.deleteMany();

  await prisma.user.deleteMany({
    where: {
      email: {
        notIn: [
          "admin@skillswap.com",
          "ali@test.com",
          "sarah@test.com",
          "hassan@test.com",
          "fatima@test.com",
          "bilal@test.com",
        ],
      },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@skillswap.com" },
    update: {
      full_name: "SkillSwap Admin",
      password_hash: passwordHash,
      role: "ADMIN",
      is_verified: true,
      is_active: true,
      location: "Islamabad",
      bio: "Platform administrator managing users, catalog, and moderation.",
    },
    create: {
      full_name: "SkillSwap Admin",
      email: "admin@skillswap.com",
      password_hash: passwordHash,
      role: "ADMIN",
      is_verified: true,
      is_active: true,
      location: "Islamabad",
      bio: "Platform administrator managing users, catalog, and moderation.",
    },
  });

  const userData = [
    {
      full_name: "Ali Khan",
      email: "ali@test.com",
      location: "Lahore",
      bio: "Frontend developer who enjoys teaching React and modern JavaScript.",
      proficiency_level: "Intermediate",
      teach: [
        { name: "React.js", level: "Intermediate" },
        { name: "JavaScript", level: "Intermediate" },
        { name: "Web Development", level: "Intermediate" },
      ],
      learn: [
        { name: "UI/UX Design", level: "Beginner" },
        { name: "Graphic Design", level: "Beginner" },
      ],
    },
    {
      full_name: "Sarah Noor",
      email: "sarah@test.com",
      location: "Islamabad",
      bio: "UI/UX designer looking to learn modern web development.",
      proficiency_level: "Intermediate",
      teach: [
        { name: "UI/UX Design", level: "Intermediate" },
        { name: "Graphic Design", level: "Intermediate" },
      ],
      learn: [
        { name: "React.js", level: "Beginner" },
        { name: "Python Programming", level: "Beginner" },
      ],
    },
    {
      full_name: "Hassan Raza",
      email: "hassan@test.com",
      location: "Karachi",
      bio: "Python developer and backend enthusiast wanting to learn design.",
      proficiency_level: "Intermediate",
      teach: [
        { name: "Python Programming", level: "Intermediate" },
      ],
      learn: [
        { name: "Graphic Design", level: "Beginner" },
        { name: "React.js", level: "Beginner" },
      ],
    },
    {
      full_name: "Fatima Zahra",
      email: "fatima@test.com",
      location: "Lahore",
      bio: "UI/UX enthusiast and designer looking to learn modern web development.",
      proficiency_level: "Intermediate",
      teach: [
        { name: "UI/UX Design", level: "Intermediate" },
        { name: "Graphic Design", level: "Intermediate" },
      ],
      learn: [
        { name: "React.js", level: "Beginner" },
        { name: "JavaScript", level: "Beginner" },
      ],
    },
    {
      full_name: "Bilal Ahmed",
      email: "bilal@test.com",
      location: "Rawalpindi",
      bio: "Web developer and lifelong tech mentor.",
      proficiency_level: "Intermediate",
      teach: [
        { name: "Web Development", level: "Intermediate" },
        { name: "JavaScript", level: "Intermediate" },
      ],
      learn: [
        { name: "UI/UX Design", level: "Beginner" },
      ],
    },
  ];

  const createdUsers = [];

  for (const item of userData) {
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        full_name: item.full_name,
        location: item.location,
        bio: item.bio,
        proficiency_level: item.proficiency_level,
        password_hash: passwordHash,
        role: "USER",
        is_verified: true,
        is_active: true,
      },
      create: {
        full_name: item.full_name,
        email: item.email,
        password_hash: passwordHash,
        location: item.location,
        bio: item.bio,
        proficiency_level: item.proficiency_level,
        role: "USER",
        is_verified: true,
        is_active: true,
      },
    });

    createdUsers.push(user);

    await prisma.userSkill.deleteMany({ where: { user_id: user.id } });

    for (const t of item.teach) {
      const skill = await prisma.skill.findUniqueOrThrow({ where: { name: t.name } });
      await prisma.userSkill.create({
        data: {
          user_id: user.id,
          skill_id: skill.id,
          skill_type: "TEACH",
          proficiency_level: t.level,
        },
      });
    }

    for (const l of item.learn) {
      const skill = await prisma.skill.findUniqueOrThrow({ where: { name: l.name } });
      await prisma.userSkill.create({
        data: {
          user_id: user.id,
          skill_id: skill.id,
          skill_type: "LEARN",
          proficiency_level: l.level,
        },
      });
    }
  }

  const [ali, sarah, hassan, fatima, bilal] = createdUsers;

  const swap1 = await prisma.swapRequest.create({
    data: {
      sender_id: ali.id,
      receiver_id: sarah.id,
      status: "COMPLETED",
      message: "Hi Sarah! I'd love to exchange React tutorials for UI/UX mentoring.",
      completed_at: new Date(),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        swap_request_id: swap1.id,
        sender_id: ali.id,
        content: "Hi Sarah! Excited to swap skills with you. When is a good time to connect?",
        is_read: true,
      },
      {
        swap_request_id: swap1.id,
        sender_id: sarah.id,
        content: "Hey Ali! Tuesday evening works great for our first session.",
        is_read: true,
      },
      {
        swap_request_id: swap1.id,
        sender_id: ali.id,
        content: "Sounds perfect! I've prepared a React starter project for us.",
        is_read: true,
      },
      {
        swap_request_id: swap1.id,
        sender_id: sarah.id,
        content: "Awesome! I'll have the Figma design walkthrough ready.",
        is_read: true,
      },
    ],
  });

  await prisma.review.createMany({
    data: [
      {
        swap_request_id: swap1.id,
        reviewer_id: sarah.id,
        reviewee_id: ali.id,
        rating: 5,
        comment: "Ali is a fantastic React mentor! Clear explanations, patient, and very helpful.",
      },
      {
        swap_request_id: swap1.id,
        reviewer_id: ali.id,
        reviewee_id: sarah.id,
        rating: 5,
        comment: "Sarah's UI/UX and Figma feedback helped transform my dashboard project completely!",
      },
    ],
  });

  const swap2 = await prisma.swapRequest.create({
    data: {
      sender_id: fatima.id,
      receiver_id: bilal.id,
      status: "COMPLETED",
      message: "Hi Bilal! Let's swap Figma UI design coaching for JavaScript fundamentals.",
      completed_at: new Date(),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        swap_request_id: swap2.id,
        sender_id: fatima.id,
        content: "Hi Bilal! Ready for our web dev and design session?",
        is_read: true,
      },
      {
        swap_request_id: swap2.id,
        sender_id: bilal.id,
        content: "Yes Fatima, looking forward to reviewing your wireframes!",
        is_read: true,
      },
    ],
  });

  await prisma.review.createMany({
    data: [
      {
        swap_request_id: swap2.id,
        reviewer_id: bilal.id,
        reviewee_id: fatima.id,
        rating: 5,
        comment: "Fatima gave exceptional UI/UX advice. Very clear and structured!",
      },
      {
        swap_request_id: swap2.id,
        reviewer_id: fatima.id,
        reviewee_id: bilal.id,
        rating: 5,
        comment: "Bilal is an excellent mentor, explained JavaScript concepts with clarity.",
      },
    ],
  });

  const swap3 = await prisma.swapRequest.create({
    data: {
      sender_id: sarah.id,
      receiver_id: hassan.id,
      status: "ACCEPTED",
      message: "Hello Hassan! Let's trade UI/UX design tips for Python automation basics.",
    },
  });

  await prisma.message.createMany({
    data: [
      {
        swap_request_id: swap3.id,
        sender_id: sarah.id,
        content: "Hi Hassan, looking forward to our design and Python session!",
        is_read: true,
      },
      {
        swap_request_id: swap3.id,
        sender_id: hassan.id,
        content: "Thanks Sarah! Looking forward to it as well.",
        is_read: true,
      },
    ],
  });

  const swap4 = await prisma.swapRequest.create({
    data: {
      sender_id: bilal.id,
      receiver_id: ali.id,
      status: "ACCEPTED",
      message: "Hey Ali! Would you like to exchange JavaScript optimizations for React state patterns?",
    },
  });

  await prisma.message.createMany({
    data: [
      {
        swap_request_id: swap4.id,
        sender_id: bilal.id,
        content: "Hi Ali, glad we connected! When can we jump on our first call?",
        is_read: true,
      },
      {
        swap_request_id: swap4.id,
        sender_id: ali.id,
        content: "Hey Bilal! Wednesday evening works great for me.",
        is_read: true,
      },
    ],
  });

  await prisma.swapRequest.create({
    data: {
      sender_id: hassan.id,
      receiver_id: fatima.id,
      status: "PENDING",
      message: "Hi Fatima! Would you be open to exchanging Python automation tips for Figma feedback?",
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        user_id: ali.id,
        type: "REVIEW",
        title: "New 5-Star Review",
        message: "Sarah Noor left you a 5-star review!",
        is_read: true,
      },
      {
        user_id: sarah.id,
        type: "SWAP_ACCEPTED",
        title: "Swap Accepted",
        message: "Hassan Raza accepted your swap request.",
        is_read: true,
      },
      {
        user_id: fatima.id,
        type: "SWAP_REQUEST",
        title: "New Swap Request",
        message: "Hassan Raza sent you a swap request.",
        is_read: false,
      },
      {
        user_id: bilal.id,
        type: "SWAP_ACCEPTED",
        title: "Swap Accepted",
        message: "Ali Khan accepted your swap request.",
        is_read: true,
      },
      {
        user_id: hassan.id,
        type: "SWAP_REQUEST",
        title: "Swap Request Sent",
        message: "Your swap request was sent to Fatima Zahra.",
        is_read: true,
      },
    ],
  });

  await prisma.profileView.createMany({
    data: [
      { viewer_id: sarah.id, viewed_user_id: ali.id },
      { viewer_id: fatima.id, viewed_user_id: bilal.id },
      { viewer_id: bilal.id, viewed_user_id: ali.id },
      { viewer_id: hassan.id, viewed_user_id: sarah.id },
      { viewer_id: ali.id, viewed_user_id: fatima.id },
    ],
  });

  await prisma.report.create({
    data: {
      reporter_id: ali.id,
      reported_user_id: hassan.id,
      reason: "Sample test moderation ticket for admin review",
      status: "PENDING",
    },
  });

  console.log("Database seeded successfully.");
  console.log("Total accounts created: 6 (5 Users + 1 Admin)");
  console.log("- Admin:  admin@skillswap.com | Password: Test@123");
  console.log("- User 1: ali@test.com        | Password: Test@123");
  console.log("- User 2: sarah@test.com      | Password: Test@123");
  console.log("- User 3: hassan@test.com     | Password: Test@123");
  console.log("- User 4: fatima@test.com     | Password: Test@123");
  console.log("- User 5: bilal@test.com      | Password: Test@123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
