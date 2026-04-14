// src/routes/+page.ts
import { supabase } from '$lib/supabaseClient';

export const ssr = false;

export async function load() {
	const {
		data: { user }
	} = await supabase.auth.getUser();

	let isDashboard = false;

	if (user) {
		const { data: userData } = await supabase
			.from('users')
			.select('*')
			.eq('type', 'dashboard')
			.eq('user_id', user.id);

		isDashboard = !!(userData && userData.length > 0);
	}

	return {
		user,
		isDashboard
	};
}
