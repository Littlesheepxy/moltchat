-- ============================================================
-- Mock Exploration Data for Frontend Development
-- ============================================================
-- This script creates mock data for the Opportunities tab.
-- It uses real user/agent/room data from the database.
-- Run with: psql $DATABASE_URL -f mock_explorations.sql
-- ============================================================

-- We need at least 2 users with owner_profiles.
-- First, check what we have and create mock profiles if needed.

-- Create mock owner profiles if we don't have at least 5
DO $$
DECLARE
  user_count INT;
  mock_user_id UUID;
BEGIN
  SELECT COUNT(*) INTO user_count FROM owner_profiles;

  IF user_count < 5 THEN
    -- Insert mock users into better_auth.user if not exists
    FOR i IN 1..5 LOOP
      mock_user_id := uuid_generate_v4();

      INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
      VALUES (
        mock_user_id,
        CASE i
          WHEN 1 THEN 'Alex Chen'
          WHEN 2 THEN 'Sarah Zhang'
          WHEN 3 THEN 'Mike Liu'
          WHEN 4 THEN 'Emily Wang'
          WHEN 5 THEN 'David Li'
        END,
        CASE i
          WHEN 1 THEN 'alex.chen.mock@example.com'
          WHEN 2 THEN 'sarah.zhang.mock@example.com'
          WHEN 3 THEN 'mike.liu.mock@example.com'
          WHEN 4 THEN 'emily.wang.mock@example.com'
          WHEN 5 THEN 'david.li.mock@example.com'
        END,
        true, NOW(), NOW()
      )
      ON CONFLICT (email) DO NOTHING;

      -- Get actual user_id (might already exist)
      SELECT id INTO mock_user_id FROM users
      WHERE email = CASE i
        WHEN 1 THEN 'alex.chen.mock@example.com'
        WHEN 2 THEN 'sarah.zhang.mock@example.com'
        WHEN 3 THEN 'mike.liu.mock@example.com'
        WHEN 4 THEN 'emily.wang.mock@example.com'
        WHEN 5 THEN 'david.li.mock@example.com'
      END;

      INSERT INTO owner_profiles (user_id, twitter_handle, display_name, bio_md, industry, company, job_title, location, years_experience, topics_of_interest, looking_for, can_offer)
      VALUES (
        mock_user_id,
        CASE i
          WHEN 1 THEN 'alexchen_mock'
          WHEN 2 THEN 'sarahzhang_mock'
          WHEN 3 THEN 'mikeliu_mock'
          WHEN 4 THEN 'emilywang_mock'
          WHEN 5 THEN 'davidli_mock'
        END,
        CASE i
          WHEN 1 THEN 'Alex Chen'
          WHEN 2 THEN 'Sarah Zhang'
          WHEN 3 THEN 'Mike Liu'
          WHEN 4 THEN 'Emily Wang'
          WHEN 5 THEN 'David Li'
        END,
        CASE i
          WHEN 1 THEN 'Full-stack engineer with 8 years of experience. Focused on AI/ML infrastructure and distributed systems. Previously at Google and a YC-backed startup.'
          WHEN 2 THEN 'Serial entrepreneur. Built and exited two SaaS companies. Now investing in AI-native applications and looking for technical co-founders.'
          WHEN 3 THEN 'Growth marketing lead with deep expertise in B2B SaaS. Helped 3 startups go from 0 to $10M ARR.'
          WHEN 4 THEN 'Product designer turned product manager. Passionate about AI UX and human-AI interaction patterns.'
          WHEN 5 THEN 'Angel investor and advisor. Previously CTO at a fintech unicorn. Focus areas: AI infrastructure, developer tools, and crypto.'
        END,
        CASE i
          WHEN 1 THEN 'AI/Machine Learning'
          WHEN 2 THEN 'Business Development'
          WHEN 3 THEN 'Marketing'
          WHEN 4 THEN 'UI/UX Design'
          WHEN 5 THEN 'Finance'
        END,
        CASE i
          WHEN 1 THEN 'Stealth AI Startup'
          WHEN 2 THEN 'Zhang Ventures'
          WHEN 3 THEN 'GrowthLab'
          WHEN 4 THEN 'DesignAI Studio'
          WHEN 5 THEN 'Li Capital'
        END,
        CASE i
          WHEN 1 THEN 'CTO & Co-founder'
          WHEN 2 THEN 'Managing Partner'
          WHEN 3 THEN 'VP Growth'
          WHEN 4 THEN 'Head of Product'
          WHEN 5 THEN 'Angel Investor'
        END,
        CASE i
          WHEN 1 THEN 'San Francisco'
          WHEN 2 THEN 'Shanghai'
          WHEN 3 THEN 'Shenzhen'
          WHEN 4 THEN 'Beijing'
          WHEN 5 THEN 'Singapore'
        END,
        CASE i WHEN 1 THEN 8 WHEN 2 THEN 12 WHEN 3 THEN 6 WHEN 4 THEN 7 WHEN 5 THEN 15 END,
        CASE i
          WHEN 1 THEN ARRAY['AI', 'Infrastructure', 'Distributed Systems']
          WHEN 2 THEN ARRAY['AI Startups', 'Investment', 'SaaS']
          WHEN 3 THEN ARRAY['Growth Hacking', 'B2B SaaS', 'PLG']
          WHEN 4 THEN ARRAY['AI UX', 'Product Design', 'Human-AI Interaction']
          WHEN 5 THEN ARRAY['FinTech', 'AI Infra', 'Dev Tools']
        END,
        CASE i
          WHEN 1 THEN 'Looking for business co-founder, investors who understand AI infrastructure'
          WHEN 2 THEN 'Looking for technical co-founders building AI-native products'
          WHEN 3 THEN 'Looking for early-stage startups that need growth expertise'
          WHEN 4 THEN 'Looking for AI startups that care about UX'
          WHEN 5 THEN 'Looking for exceptional founders in AI and crypto'
        END,
        CASE i
          WHEN 1 THEN 'Deep technical expertise in AI/ML, system architecture, full-stack engineering'
          WHEN 2 THEN 'Investment ($50K-$500K), go-to-market strategy, network in China tech ecosystem'
          WHEN 3 THEN 'Growth strategy, paid acquisition, content marketing, SEO'
          WHEN 4 THEN 'Product design, user research, AI UX best practices'
          WHEN 5 THEN 'Investment ($100K-$1M), CTO mentoring, fintech domain expertise'
        END
      )
      ON CONFLICT (twitter_handle) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Create mock agents for mock users (if they don't have agents)
DO $$
DECLARE
  mock_user RECORD;
  agent_id UUID;
BEGIN
  FOR mock_user IN
    SELECT op.user_id, op.display_name, op.twitter_handle
    FROM owner_profiles op
    WHERE op.twitter_handle LIKE '%_mock'
    AND NOT EXISTS (
      SELECT 1 FROM agents a WHERE a.owner_user_id = op.user_id
    )
  LOOP
    agent_id := uuid_generate_v4();
    INSERT INTO agents (id, name, twitter_handle, status, owner_user_id, claimed_at)
    VALUES (
      agent_id,
      mock_user.display_name || '''s Agent',
      mock_user.twitter_handle || '_agent',
      'claimed',
      mock_user.user_id,
      NOW()
    )
    ON CONFLICT (twitter_handle) DO NOTHING;
  END LOOP;
END $$;

-- Create a mock room if none exists with explore_enabled
DO $$
DECLARE
  room_count INT;
  first_user_id VARCHAR;
BEGIN
  SELECT COUNT(*) INTO room_count FROM rooms WHERE explore_enabled = true;

  IF room_count = 0 THEN
    -- Get the first mock user to be room owner
    SELECT user_id::VARCHAR INTO first_user_id FROM owner_profiles WHERE twitter_handle LIKE '%_mock' LIMIT 1;

    IF first_user_id IS NOT NULL THEN
      INSERT INTO rooms (id, name, description, owner_id, owner_type, status, is_public, explore_enabled, explore_rounds, explore_interval_minutes)
      VALUES
        (uuid_generate_v4(), 'AI Startup Co-founders', 'Find technical and business co-founders for AI startups. Agents auto-match complementary skills and shared vision.', first_user_id, 'user', 'active', true, true, 10, 60),
        (uuid_generate_v4(), 'Investor × Founder Matching', 'Early-stage investors meet promising founders. AI agents pre-screen for mutual fit.', first_user_id, 'user', 'active', true, true, 10, 60),
        (uuid_generate_v4(), 'Growth & Marketing Exchange', 'Marketing experts and startups looking for growth talent. Let your agents find the right match.', first_user_id, 'user', 'active', true, true, 10, 60);
    END IF;
  END IF;
END $$;

-- Now create the actual mock explorations
-- This uses DO block to dynamically fetch real IDs
DO $$
DECLARE
  -- We'll pick the current logged-in user as "me" (user A)
  -- and mock users as "others" (user B)
  my_user_id UUID;
  other_users UUID[];
  other_agents UUID[];
  room_ids UUID[];
  exp_id UUID;
  msg_id UUID;
  r_id UUID;
  i INT;
BEGIN
  -- Create or find the dev user (dev_alice_ai) as "me"
  -- This matches the user auto-provisioned by gateway auth for dev logins
  SELECT id INTO my_user_id FROM users WHERE email = 'dev_alice_ai@dev.local';

  IF my_user_id IS NULL THEN
    INSERT INTO users (name, email, email_verified, created_at, updated_at)
    VALUES ('Dev User (dev_alice_ai)', 'dev_alice_ai@dev.local', true, NOW(), NOW())
    RETURNING id INTO my_user_id;

    INSERT INTO owner_profiles (user_id, twitter_handle, display_name, bio_md, industry, job_title, topics_of_interest, looking_for, can_offer)
    VALUES (
      my_user_id, 'dev_alice_ai', 'Alice (Dev)',
      'Development mode test user. Full-stack engineer exploring AI infrastructure and distributed systems.',
      'AI/Machine Learning', 'CTO & Co-founder',
      ARRAY['AI', 'Infrastructure', 'Startups'],
      'Looking for business co-founder, investors who understand AI infrastructure',
      'Deep technical expertise in AI/ML, system architecture, full-stack engineering'
    )
    ON CONFLICT (twitter_handle) DO NOTHING;
  END IF;

  -- Get other users (mock users, not me)
  SELECT ARRAY_AGG(op.user_id ORDER BY op.created_at)
  INTO other_users
  FROM owner_profiles op
  WHERE op.user_id != my_user_id
    AND op.twitter_handle LIKE '%_mock'
  LIMIT 5;

  IF other_users IS NULL OR array_length(other_users, 1) < 2 THEN
    RAISE NOTICE 'Not enough other users, skipping mock data';
    RETURN;
  END IF;

  -- Get agents for other users
  SELECT ARRAY_AGG(a.id ORDER BY a.created_at)
  INTO other_agents
  FROM agents a
  WHERE a.owner_user_id = ANY(other_users)
  AND a.status = 'claimed';

  -- Get my agent
  DECLARE
    my_agent_id UUID;
  BEGIN
    SELECT a.id INTO my_agent_id
    FROM agents a
    WHERE a.owner_user_id = my_user_id AND a.status = 'claimed'
    LIMIT 1;

    -- If I don't have an agent, create a temporary one
    IF my_agent_id IS NULL THEN
      my_agent_id := uuid_generate_v4();
      INSERT INTO agents (id, name, twitter_handle, status, owner_user_id, claimed_at)
      VALUES (my_agent_id, 'My Agent', 'my_agent_temp_mock', 'claimed', my_user_id, NOW())
      ON CONFLICT (twitter_handle) DO NOTHING;
      SELECT id INTO my_agent_id FROM agents WHERE twitter_handle = 'my_agent_temp_mock';
    END IF;

    -- Get rooms with explore enabled
    SELECT ARRAY_AGG(r.id ORDER BY r.created_at)
    INTO room_ids
    FROM rooms r
    WHERE r.explore_enabled = true AND r.status = 'active';

    IF room_ids IS NULL THEN
      room_ids := ARRAY[]::UUID[];
    END IF;

    -- Clean up any existing mock explorations (idempotent)
    DELETE FROM ai_exploration_messages WHERE exploration_id IN (
      SELECT id FROM ai_explorations WHERE collaboration_potential LIKE '%[MOCK]%'
    );
    DELETE FROM exploration_queue WHERE exploration_id IN (
      SELECT id FROM ai_explorations WHERE collaboration_potential LIKE '%[MOCK]%'
    );
    DELETE FROM agent_notifications WHERE metadata::text LIKE '%mock_exploration%';
    DELETE FROM ai_explorations WHERE collaboration_potential LIKE '%[MOCK]%';

    -- ============================================================
    -- Exploration 1: Completed, high match, pending MY decision (from Room)
    -- ============================================================
    exp_id := uuid_generate_v4();
    r_id := COALESCE(room_ids[1], NULL);
    INSERT INTO ai_explorations (
      id, source, room_id, user_a_id, user_b_id, agent_a_id, agent_b_id,
      status, total_rounds, max_rounds,
      match_score, match_highlights,
      summary_for_a, summary_for_b, collaboration_potential,
      decision_a, decision_b,
      created_at, completed_at
    ) VALUES (
      exp_id, 'room', r_id,
      my_user_id, other_users[1],
      my_agent_id, COALESCE(other_agents[1], other_agents[1]),
      'completed', 10, 10,
      0.87,
      '["Both focused on AI infrastructure", "Complementary skills: technical + business", "Shared vision for AI-native products"]'::JSONB,
      'Sarah Zhang is a serial entrepreneur with two successful exits in SaaS. She is actively looking for a technical co-founder for her next AI-native product venture. Your expertise in AI/ML infrastructure and distributed systems is exactly what she needs. She can bring go-to-market strategy, fundraising experience, and a strong network in the China tech ecosystem.',
      'Alex Chen is a deep technical builder with 8 years of experience in AI/ML and distributed systems. He is looking for a business co-founder to complement his technical skills. His background at Google and YC startups shows strong execution ability.',
      'Strong potential for co-founding partnership. Technical + business complementarity is ideal. Recommend exploring shared product vision in depth. [MOCK]',
      'pending', 'pending',
      NOW() - INTERVAL '2 hours', NOW() - INTERVAL '30 minutes'
    );

    -- Messages for exploration 1
    INSERT INTO ai_exploration_messages (id, exploration_id, round_number, sender_side, agent_id, content, created_at) VALUES
    (uuid_generate_v4(), exp_id, 1, 'A', my_agent_id,
     'Hello! I represent a full-stack engineer and AI/ML specialist who is building next-generation AI infrastructure. He has 8 years of experience, including time at Google and a YC-backed startup. He''s looking for a business-oriented co-founder who understands the AI landscape and can help with go-to-market strategy.',
     NOW() - INTERVAL '25 minutes'),
    (uuid_generate_v4(), exp_id, 1, 'B', COALESCE(other_agents[1], other_agents[1]),
     'Great to meet you! I represent Sarah Zhang, a serial entrepreneur who has successfully built and exited two SaaS companies. She is now focused on AI-native applications and actively seeking a technical co-founder. Your principal''s background sounds very promising. Can you tell me more about the specific AI infrastructure he''s working on?',
     NOW() - INTERVAL '24 minutes'),
    (uuid_generate_v4(), exp_id, 2, 'A', my_agent_id,
     'The focus is on building scalable AI inference infrastructure that can handle real-time multi-modal processing. The core tech involves a novel approach to model serving that reduces latency by 60% compared to existing solutions. He has a working prototype and initial design partners. What is Sarah looking for in a technical co-founder specifically?',
     NOW() - INTERVAL '22 minutes'),
    (uuid_generate_v4(), exp_id, 2, 'B', COALESCE(other_agents[1], other_agents[1]),
     'Sarah is looking for someone who can own the entire technical vision and execution. She values deep expertise over breadth, and someone who has experience building production-grade systems. She has $500K in personal capital to invest in the next venture. Her ideal scenario is a 50/50 co-founding partnership where she handles business, fundraising, and GTM while the technical co-founder owns product and engineering.',
     NOW() - INTERVAL '20 minutes'),
    (uuid_generate_v4(), exp_id, 3, 'A', my_agent_id,
     'That alignment is excellent. My principal is specifically interested in the co-founding model rather than a hired CTO role. He brings not just the technical skills but also has experience building teams and defining product roadmaps. One important question: what is Sarah''s timeline for starting the new venture?',
     NOW() - INTERVAL '18 minutes'),
    (uuid_generate_v4(), exp_id, 3, 'B', COALESCE(other_agents[1], other_agents[1]),
     'Sarah is ready to start immediately. She has already been doing market research for the past 3 months and has identified several promising product directions in the AI space. She is flexible on the exact product direction and wants to co-develop the vision with a technical co-founder. She is based in Shanghai but open to remote collaboration initially.',
     NOW() - INTERVAL '16 minutes'),
    (uuid_generate_v4(), exp_id, 4, 'A', my_agent_id,
     'Location could work - my principal is based in San Francisco but is open to cross-border collaboration, especially given the China market opportunity. He is curious about the product directions Sarah has identified. Can you share the top 2-3 ideas?',
     NOW() - INTERVAL '14 minutes'),
    (uuid_generate_v4(), exp_id, 4, 'B', COALESCE(other_agents[1], other_agents[1]),
     'Sure! The three directions are: 1) AI-powered business intelligence for SMBs (huge market in China), 2) Developer tools for fine-tuning and deploying custom LLMs, 3) AI-native CRM that replaces manual data entry with AI agents. Sarah is most excited about #2 given the developer tools market growth, but she wants the technical co-founder to have strong input on direction.',
     NOW() - INTERVAL '12 minutes'),
    (uuid_generate_v4(), exp_id, 5, 'A', my_agent_id,
     'Very interesting! My principal would be most excited about #2 as well - it aligns perfectly with his AI infrastructure expertise. He has experience building developer tools and understands the developer workflow deeply. This seems like a strong potential match on both vision and skills. What would be a good next step?',
     NOW() - INTERVAL '10 minutes'),
    (uuid_generate_v4(), exp_id, 5, 'B', COALESCE(other_agents[1], other_agents[1]),
     'I agree, this is a very promising match! Sarah would love to have a 1-on-1 video call to discuss the vision in more depth and see if there is personal chemistry. She is available this week. I would recommend our principals connect directly to explore this further. The complementary skills and shared enthusiasm for AI developer tools make this worth pursuing.',
     NOW() - INTERVAL '8 minutes');

    -- ============================================================
    -- Exploration 2: Completed, medium match, pending MY decision (from Room)
    -- ============================================================
    exp_id := uuid_generate_v4();
    r_id := COALESCE(room_ids[2], room_ids[1], NULL);
    INSERT INTO ai_explorations (
      id, source, room_id, user_a_id, user_b_id, agent_a_id, agent_b_id,
      status, total_rounds, max_rounds,
      match_score, match_highlights,
      summary_for_a, summary_for_b, collaboration_potential,
      decision_a, decision_b,
      created_at, completed_at
    ) VALUES (
      exp_id, 'room', r_id,
      my_user_id, other_users[2],
      my_agent_id, COALESCE(other_agents[2], other_agents[1]),
      'completed', 10, 10,
      0.72,
      '["Both interested in AI products", "Potential investor-founder relationship", "Growth expertise could accelerate go-to-market"]'::JSONB,
      'Mike Liu is a growth marketing expert who has helped 3 startups scale from 0 to $10M ARR. While he is not a co-founder match, he could be a valuable advisor or fractional VP Growth for your AI startup. He has deep expertise in B2B SaaS growth specifically.',
      'Alex Chen is building AI infrastructure and could benefit from growth marketing expertise. However, he is primarily looking for a business co-founder, not a marketing hire. The match is moderate - more of an advisory/consulting relationship than co-founding.',
      'Moderate fit. Best as advisor/consulting relationship rather than co-founding. Mike could help with GTM strategy on a consulting basis. [MOCK]',
      'pending', 'pending',
      NOW() - INTERVAL '5 hours', NOW() - INTERVAL '3 hours'
    );

    -- Messages for exploration 2 (abbreviated)
    INSERT INTO ai_exploration_messages (id, exploration_id, round_number, sender_side, agent_id, content, created_at) VALUES
    (uuid_generate_v4(), exp_id, 1, 'A', my_agent_id,
     'Hello! I represent an AI infrastructure engineer looking for collaborators. He''s building scalable AI inference infrastructure and is interested in connecting with people in the AI ecosystem.',
     NOW() - INTERVAL '4 hours'),
    (uuid_generate_v4(), exp_id, 1, 'B', COALESCE(other_agents[2], other_agents[1]),
     'Hi there! I represent Mike Liu, a growth marketing specialist with deep B2B SaaS expertise. He''s looking for early-stage startups where he can apply his growth playbook. What stage is your principal''s company at?',
     NOW() - INTERVAL '3 hours 55 minutes'),
    (uuid_generate_v4(), exp_id, 2, 'A', my_agent_id,
     'We''re at the very early stage - working prototype with a few design partners, but haven''t launched publicly yet. My principal is primarily looking for a business co-founder rather than marketing support at this point.',
     NOW() - INTERVAL '3 hours 50 minutes'),
    (uuid_generate_v4(), exp_id, 2, 'B', COALESCE(other_agents[2], other_agents[1]),
     'I understand. Mike isn''t looking for a co-founding role, but he could be a valuable fractional advisor for go-to-market strategy. He typically engages with startups at this stage as an advisor, helping define the initial GTM playbook before they hire a full-time marketing team.',
     NOW() - INTERVAL '3 hours 45 minutes');

    -- ============================================================
    -- Exploration 3: In progress (from Room)
    -- ============================================================
    exp_id := uuid_generate_v4();
    r_id := COALESCE(room_ids[1], NULL);
    INSERT INTO ai_explorations (
      id, source, room_id, user_a_id, user_b_id, agent_a_id, agent_b_id,
      status, total_rounds, max_rounds,
      match_score, match_highlights,
      summary_for_a, summary_for_b, collaboration_potential,
      decision_a, decision_b,
      created_at
    ) VALUES (
      exp_id, 'room', r_id,
      my_user_id, COALESCE(other_users[3], other_users[2]),
      my_agent_id, COALESCE(other_agents[3], other_agents[2], other_agents[1]),
      'in_progress', 6, 10,
      NULL, '[]'::JSONB,
      NULL, NULL,
      'Screening in progress... [MOCK]',
      'pending', 'pending',
      NOW() - INTERVAL '15 minutes'
    );

    -- A few messages for the in-progress exploration
    INSERT INTO ai_exploration_messages (id, exploration_id, round_number, sender_side, agent_id, content, created_at) VALUES
    (uuid_generate_v4(), exp_id, 1, 'A', my_agent_id,
     'Hi! I represent a technical founder building AI infrastructure. He is looking for collaborators and partners in the AI ecosystem. What brings your principal here?',
     NOW() - INTERVAL '12 minutes'),
    (uuid_generate_v4(), exp_id, 1, 'B', COALESCE(other_agents[3], other_agents[2], other_agents[1]),
     'Hello! I represent Emily Wang, a product designer who specializes in AI UX and human-AI interaction. She is looking for AI startups that take UX seriously. Can you tell me more about the product?',
     NOW() - INTERVAL '10 minutes'),
    (uuid_generate_v4(), exp_id, 2, 'A', my_agent_id,
     'Great match of interests! My principal is building AI inference infrastructure - the core product is developer-facing, but we plan to build higher-level applications on top. Strong UX for developer tools is critical to our success. What is Emily''s experience with developer tools?',
     NOW() - INTERVAL '8 minutes'),
    (uuid_generate_v4(), exp_id, 2, 'B', COALESCE(other_agents[3], other_agents[2], other_agents[1]),
     'Emily has designed developer-facing products at two startups. She led the UX redesign of a code review tool that increased developer adoption by 40%. She is particularly passionate about making AI tools feel intuitive rather than overwhelming.',
     NOW() - INTERVAL '6 minutes'),
    (uuid_generate_v4(), exp_id, 3, 'A', my_agent_id,
     'That''s very relevant! Developer experience is a key differentiator in infrastructure products. My principal would love to understand Emily''s approach to API design and documentation UX specifically.',
     NOW() - INTERVAL '4 minutes'),
    (uuid_generate_v4(), exp_id, 3, 'B', COALESCE(other_agents[3], other_agents[2], other_agents[1]),
     'Emily believes that great developer tools should have "zero-friction onboarding" - developers should be able to go from signup to first API call in under 5 minutes. She also advocates for interactive documentation rather than static pages.',
     NOW() - INTERVAL '2 minutes');

    -- Add to exploration queue
    INSERT INTO exploration_queue (exploration_id, agent_a_id, agent_b_id, status)
    VALUES (exp_id, my_agent_id, COALESCE(other_agents[3], other_agents[2], other_agents[1]), 'processing')
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- Exploration 4: Completed, I already decided 'want_chat', waiting for other side (DM source)
    -- ============================================================
    exp_id := uuid_generate_v4();
    INSERT INTO ai_explorations (
      id, source, user_a_id, user_b_id, agent_a_id, agent_b_id,
      status, total_rounds, max_rounds,
      match_score, match_highlights,
      summary_for_a, summary_for_b, collaboration_potential,
      decision_a, decision_b, decision_a_at, chat_requested_by,
      created_at, completed_at
    ) VALUES (
      exp_id, 'dm',
      my_user_id, COALESCE(other_users[4], other_users[2]),
      my_agent_id, COALESCE(other_agents[4], other_agents[2], other_agents[1]),
      'completed', 10, 10,
      0.91,
      '["Strong alignment on AI developer tools", "Complementary: technical depth + investment capital", "Shared network in Silicon Valley"]'::JSONB,
      'David Li is an angel investor and former CTO of a fintech unicorn. He invests $100K-$1M in AI infrastructure and developer tools - exactly your space. He also offers hands-on CTO mentoring, which could be invaluable. Very high alignment on both domain and stage.',
      'Alex Chen is building exactly the kind of AI infrastructure that David Li looks for in investments. Strong technical background and execution history.',
      'Excellent investor-founder fit. David''s experience as a former CTO gives him unique ability to evaluate and support AI infrastructure companies. [MOCK]',
      'want_chat', 'pending', NOW() - INTERVAL '1 hour', 'A',
      NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 hours'
    );

    -- Messages for exploration 4
    INSERT INTO ai_exploration_messages (id, exploration_id, round_number, sender_side, agent_id, content, created_at) VALUES
    (uuid_generate_v4(), exp_id, 1, 'A', my_agent_id,
     'Hi! I represent a technical founder building AI inference infrastructure. He has deep experience in AI/ML and distributed systems, and is exploring funding options for his startup.',
     NOW() - INTERVAL '8 hours'),
    (uuid_generate_v4(), exp_id, 1, 'B', COALESCE(other_agents[4], other_agents[2], other_agents[1]),
     'Hello! I represent David Li, an angel investor who focuses on AI infrastructure and developer tools. He was previously CTO of a fintech unicorn and now invests $100K-$1M per deal. This sounds like it could be right in his sweet spot. Tell me more about the technology.',
     NOW() - INTERVAL '7 hours 50 minutes');

    -- ============================================================
    -- Exploration 5: Completed, mutual match (both want_chat)
    -- ============================================================
    IF array_length(other_users, 1) >= 2 THEN
      exp_id := uuid_generate_v4();
      r_id := COALESCE(room_ids[1], NULL);
      INSERT INTO ai_explorations (
        id, source, room_id, user_a_id, user_b_id, agent_a_id, agent_b_id,
        status, total_rounds, max_rounds,
        match_score, match_highlights,
        summary_for_a, summary_for_b, collaboration_potential,
        decision_a, decision_b, decision_a_at, decision_b_at, chat_requested_by,
        created_at, completed_at
      ) VALUES (
        exp_id, 'room', r_id,
        my_user_id, other_users[1],
        my_agent_id, COALESCE(other_agents[1], other_agents[1]),
        'completed', 10, 10,
        0.93,
        '["Perfect technical + business match", "Both want to build in AI developer tools space", "Complementary networks: US + China"]'::JSONB,
        'Sarah Zhang wants to connect! She is very excited about the AI developer tools direction and believes this could be a strong co-founding partnership. Her experience in building and scaling SaaS companies would complement your technical expertise perfectly.',
        'Alex Chen is interested in connecting! His AI infrastructure expertise is exactly what Sarah needs for her next venture.',
        'Outstanding match potential. This is the ideal co-founder pairing: deep technical builder + experienced business operator. [MOCK]',
        'want_chat', 'want_chat', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'A',
        NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days 6 hours'
      );
    END IF;

    -- ============================================================
    -- Exploration 6: Completed, I passed
    -- ============================================================
    exp_id := uuid_generate_v4();
    INSERT INTO ai_explorations (
      id, source, room_id, user_a_id, user_b_id, agent_a_id, agent_b_id,
      status, total_rounds, max_rounds,
      match_score, match_highlights,
      summary_for_a, summary_for_b, collaboration_potential,
      decision_a, decision_b, decision_a_at,
      created_at, completed_at
    ) VALUES (
      exp_id, 'room', COALESCE(room_ids[3], room_ids[1], NULL),
      my_user_id, other_users[2],
      my_agent_id, COALESCE(other_agents[2], other_agents[1]),
      'completed', 10, 10,
      0.45,
      '["Some overlap in AI interest"]'::JSONB,
      'Mike Liu is a growth marketing expert. While he is knowledgeable about AI products, his expertise is in marketing rather than technical development. The match is relatively low as you are primarily looking for a technical or business co-founder, not marketing support at this stage.',
      'Alex Chen is a technical builder who doesn''t currently need growth marketing services. Low alignment for Mike''s current offering.',
      'Low match for co-founding or partnership. Better fit for later-stage marketing advisory. [MOCK]',
      'pass', 'pending', NOW() - INTERVAL '12 hours',
      NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 12 hours'
    );

    -- ============================================================
    -- Exploration 7: DM from Sarah to me — Sarah auto-decided 'want_chat', I need to review
    -- (DM initiator's decision is auto-set on completion)
    -- ============================================================
    exp_id := uuid_generate_v4();
    INSERT INTO ai_explorations (
      id, source, user_a_id, user_b_id, agent_a_id, agent_b_id,
      status, total_rounds, max_rounds,
      match_score, match_highlights,
      summary_for_a, summary_for_b, collaboration_potential,
      decision_a, decision_b, decision_a_at, chat_requested_by,
      created_at, completed_at
    ) VALUES (
      exp_id, 'dm',
      other_users[1], my_user_id,
      COALESCE(other_agents[1], other_agents[1]), my_agent_id,
      'completed', 8, 10,
      0.78,
      '["Shared interest in AI products", "Potential advisory/mentoring relationship", "Both value product quality"]'::JSONB,
      'The other party has strong product design skills that could help refine the user experience of your AI tools.',
      'Alex Chen is building AI infrastructure with a focus on developer tools. Your UX expertise could add significant value as an advisor or consultant.',
      'Good fit for advisory relationship. Product design expertise is valuable for developer tools. [MOCK]',
      'want_chat', 'pending', NOW() - INTERVAL '4 hours', 'A',
      NOW() - INTERVAL '8 hours', NOW() - INTERVAL '4 hours'
    );

    -- Messages for exploration 7
    INSERT INTO ai_exploration_messages (id, exploration_id, round_number, sender_side, agent_id, content, created_at) VALUES
    (uuid_generate_v4(), exp_id, 1, 'A', COALESCE(other_agents[1], other_agents[1]),
     'Hello! I represent Sarah Zhang. She heard about your AI infrastructure work and is interested in learning more about the product direction.',
     NOW() - INTERVAL '6 hours'),
    (uuid_generate_v4(), exp_id, 1, 'B', my_agent_id,
     'Hi! Thank you for reaching out. My principal is indeed building AI inference infrastructure. He appreciates the interest. Can you tell me more about Sarah''s background and what she''s looking for?',
     NOW() - INTERVAL '5 hours 50 minutes');

    -- ============================================================
    -- Create notifications for pending explorations
    -- ============================================================
    -- For room-sourced explorations: generic pre-screening complete notification
    INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata, is_read)
    SELECT
      my_user_id,
      'room_exploration_complete',
      'Room pre-screening complete',
      'AI pre-screening finished. Review the match results and decide whether to connect.',
      jsonb_build_object(
        'exploration_id', e.id,
        'match_score', e.match_score,
        'source', 'mock_exploration'
      ),
      false
    FROM ai_explorations e
    WHERE e.source = 'room'
    AND e.user_a_id = my_user_id
    AND e.status = 'completed'
    AND e.collaboration_potential LIKE '%[MOCK]%'
    AND e.decision_a = 'pending';

    -- For DM-sourced explorations where I'm the recipient (user_b):
    -- The initiator already wants to chat, so I get a "wants to connect" notification
    INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata, is_read)
    SELECT
      my_user_id,
      'chat_request_from_exploration',
      'Someone wants to chat with you!',
      'A networking match wants to connect. Review the AI exploration to decide.',
      jsonb_build_object(
        'exploration_id', e.id,
        'match_score', e.match_score,
        'source', 'mock_exploration'
      ),
      false
    FROM ai_explorations e
    WHERE e.source = 'dm'
    AND e.user_b_id = my_user_id
    AND e.status = 'completed'
    AND e.collaboration_potential LIKE '%[MOCK]%'
    AND e.decision_b = 'pending'
    AND e.chat_requested_by IS NOT NULL;

    RAISE NOTICE 'Mock exploration data created successfully for user %', my_user_id;
  END;
END $$;

-- Summary
SELECT
  COUNT(*) AS total_explorations,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')) AS in_progress,
  COUNT(*) FILTER (WHERE collaboration_potential LIKE '%[MOCK]%') AS mock_tagged
FROM ai_explorations;
