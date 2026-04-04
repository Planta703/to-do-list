import { redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function load() {
	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) {
		throw redirect(303, '/');
	}
	const { data: userData } = await supabase
		.from('users')
		.select('*')
		.eq('type', 'dashboard')
		.eq('user_id', user.id);
	if (!userData || userData.length === 0) {
		throw redirect(303, '/');
	}
}
