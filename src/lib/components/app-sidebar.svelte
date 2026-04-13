<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { supabase } from '@/supabaseClient';
	import { onMount, tick } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { MessageCirclePlus, ArrowDown } from '@lucide/svelte';
	import { type Database } from '$lib/types/database.types';
	import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

	type Message = Database['public']['Tables']['Messages']['Row'];

	let message = $state('');
	let messages: Message[] = $state([]);
	let user_id = $state('');
	let messagesContainer: HTMLDivElement;
	let isAtBottom = $state(true);
	let displayNames: Record<string, string> = $state({});

	async function getDisplayNames(userId: string) {
		if (displayNames[userId]) return;

		const { data } = await supabase
			.from('users')
			.select('display_name')
			.eq('user_id', userId)
			.single();

		displayNames[userId] = data?.display_name;
	}

	onMount(() => {
		// Kick off async work without awaiting it here
		setup();

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event) => {
			if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
				userData();
			}
		});

		// Return cleanup synchronously — Svelte is happy
		return () => {
			subscription.unsubscribe();
			supabase.removeAllChannels();
		};
	});

	// Move all the async setup into its own function
	async function setup() {
		await userData();
		supabase
			.channel('Messages')
			.on<Message>(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'Messages' },
				(payload: RealtimePostgresInsertPayload<Message>) => {
					const row = payload.new;
					if (!row) return;
					messages = [...messages, row];
					getDisplayNames(row.user_id);
					if (isAtBottom) scrollToBottom(true);
				}
			)
			.subscribe();

		await loadMessages();
		scrollToBottom(true);
	}

	async function userData() {
		const { data: userData } = await supabase.auth.getSession();

		user_id = userData.session?.user.id ?? '';
	}

	function checkIfAtBottom(): boolean {
		if (!messagesContainer) return true;
		const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
		return scrollHeight - scrollTop - clientHeight < 50;
	}

	function handleScroll() {
		isAtBottom = checkIfAtBottom();
	}

	async function scrollToBottom(smooth = true) {
		await tick();
		if (!messagesContainer) return;
		messagesContainer.scrollTo({
			top: messagesContainer.scrollHeight,
			behavior: smooth ? 'smooth' : 'instant'
		});
		isAtBottom = true;
	}

	async function loadMessages() {
		const { data } = await supabase
			.from('Messages')
			.select('*')
			.order('created_at', { ascending: true })
			.limit(30);
		messages = data ?? [];
		await Promise.all(messages.map((msg) => getDisplayNames(msg.user_id)));
	}

	async function sendMessage() {
		if (!message) return;
		await supabase.from('Messages').insert({
			user_id: user_id,
			content: message
		});
		message = '';
	}
</script>

<Sidebar.Root side="right">
	<Sidebar.Header />
	<Sidebar.Content>
		<div
			bind:this={messagesContainer}
			onscroll={handleScroll}
			class="h-[calc(100vh-5rem)] overflow-y-auto"
		>
			<div class="mx-auto mt-10 mb-1 flex w-5/6 flex-col gap-y-5">
				{#each messages as msg (msg.message_id)}
					<Card.Root class="max-w-md gap-0 {msg.user_id !== user_id ? 'self-start' : 'self-end'}">
						<Card.Content>
							<p class="font-bold">{displayNames[msg.user_id]}</p>
							{msg.content}
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		</div>
	</Sidebar.Content>
	<Sidebar.Footer>
		{#if !isAtBottom}
			<div class="flex w-full justify-center">
				<Button onclick={() => scrollToBottom(true)}><ArrowDown /></Button>
			</div>
		{/if}
		<div class=" flex w-full justify-center">
			<div class="flex w-5/6 gap-2">
				<Input class="flex flex-1" bind:value={message} />
				{#if message}
					<Button onclick={() => sendMessage()}><MessageCirclePlus /></Button>
				{:else}
					<Button disabled onclick={() => sendMessage()}><MessageCirclePlus /></Button>
				{/if}
			</div>
		</div>
	</Sidebar.Footer>
</Sidebar.Root>
