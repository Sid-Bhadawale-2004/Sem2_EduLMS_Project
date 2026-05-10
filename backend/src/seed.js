require('dotenv').config();
require('./utils/db');
const bcrypt = require('bcryptjs');
const { User } = require('./models');

async function seed() {
  const email    = process.env.ADMIN_EMAIL    || 'admin@edlums.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';

  const exists = await User.findOne({ email });
  if (exists) {
    console.log(`✅ Admin already exists: ${email}`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ email, passwordHash, role: 'ADMIN' });

  console.log('✅ Admin account created!');
  console.log(`   Email   : ${email}`);
  console.log(`   Password: ${password}`);
  console.log('\n⚠️  Change the password after first login!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
