<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import DropdownMenuContent from '@/components/ui/dropdown-menu/dropdown-menu-content.svelte';
	import DropdownMenuTrigger from '@/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
	import InputGroupAddon from '@/components/ui/input-group/input-group-addon.svelte';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import DialogTrigger from '@/components/ui/dialog/dialog-trigger.svelte';
	import DialogContent from '@/components/ui/dialog/dialog-content.svelte';
	import * as Field from '$lib/components/ui/field/index.js';
	import Button from '@/components/ui/button/button.svelte';
	import Input from '@/components/ui/input/input.svelte';
	import { supabase } from '$lib/supabaseClient.js';
	import { onMount, onDestroy } from 'svelte';
	import {
		CalendarPlus,
		SendHorizontal,
		Check,
		CircleCheck,
		Trash2,
		CircleDashed
	} from '@lucide/svelte';
	import { buttonVariants } from '@/components/ui/button/button.svelte';
	import { cn } from '@/utils';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import Textarea from '@/components/ui/textarea/textarea.svelte';
	import * as Collapsible from '@/components/ui/collapsible';
	import * as HoverCard from '$lib/components/ui/hover-card/index.js';

	type Item = {
		item_id: string;
		user_id: string;
		title: string;
		text: string;
		checked: boolean;
		date: string;
		deleted: boolean;
		dashboard: boolean;
	};

	let value = $state(today(getLocalTimeZone()));
	let list = $state<Item[]>([]); // keep the list as reactive state
	let input_title = $state('');
	let input_text = $state('');
	let email = $state('');
	let password = $state('');
	let currentUserId = $state('');
	let dashboard = $state(false);
	let signin = $state(true);
	let error_message = $state('');
	let email_sent = $state(false);
	let inputerror = $state('You are not anonymous. Be mindful of what you input.');
	let loading = $state(false);

	supabase.auth.onAuthStateChange((event) => {
		if (event === 'SIGNED_IN') userId();
		loadItems();
		inputerror = 'You are not anonymous. Be mindful of what you input.';
		if (event === 'SIGNED_OUT') currentUserId = '';
		list = [];
		dashboard = false;
	});

	onMount(async () => {
		loadItems();
		await userId();

		const subscription = supabase
			.channel('public:Items')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'Items' }, (payload) => {
				const row = (payload.new ?? payload.old) as Item | null;
				if (!row) return;

				switch (payload.eventType) {
					case 'INSERT':
						list = [...list, row];
						break;
					case 'UPDATE':
						if (row.deleted) {
							list = list.filter((item) => item.item_id !== row.item_id);
						} else {
							list = list.map((item) => (item.item_id === row.item_id ? row : item));
						}
						break;
					case 'DELETE':
						list = list.filter((item) => item.item_id !== row.item_id);
						break;

					default:
						break;
				}
			})
			.subscribe();

		onDestroy(() => {
			supabase.removeChannel(subscription);
		});
	});

	async function loadItems() {
		const { data } = await supabase.from('Items').select('*').eq('deleted', false);
		list = data ?? [];
	}

	async function userId() {
		const { data } = await supabase.auth.getUser();
		if (data.user) {
			currentUserId = data.user.id;
			const { data: userData } = await supabase
				.from('users')
				.select('*')
				.eq('type', 'dashboard')
				.eq('user_id', currentUserId);
			if (userData && userData.length > 0) {
				dashboard = true;
			}
		}
	}

	async function signIn() {
		const { error } = await supabase.auth.signInWithPassword({
			email: email,
			password: password
		});
		if (error) {
			error_message = error.message;
		} else {
			error_message = '';
		}
	}

	async function signUp() {
		const { error } = await supabase.auth.signUp({
			email: email,
			password: password
		});
		if (error) {
			error_message = error.message;
		} else {
			email_sent = true;
			error_message = '';
		}
	}

	async function signOut() {
		await supabase.auth.signOut({ scope: 'local' });
	}

	$effect(() => {
		list.sort((a, b) => {
			if (a.checked !== b.checked) {
				return Number(a.checked) - Number(b.checked);
			}
			if (a.dashboard !== b.dashboard) {
				return Number(b.dashboard) - Number(a.dashboard);
			}
			if (a.checked) {
				if (a.date > b.date) return -1;
				if (a.date < b.date) return 1;
			} else {
				if (a.date < b.date) return -1;
				if (a.date > b.date) return 1;
			}

			return 0;
		});
	});

	async function dashboardAdd(item: Item) {
		await supabase
			.from('Items')
			.update({ dashboard: true })
			.eq('item_id', item.item_id) // ← Add this: filter by primary key
			.select(); // Optional: returns updated row(s)
	}

	async function itemsToList() {
		if (!input_title.trim() || !input_text.trim()) {
			inputerror = 'Please fill in all fields!';
			return;
		}
		loading = true;

		if (!dashboard) {
			const fetchresult = await fetch('/api/moderate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					text: `Title: ${input_title.trim()}; Description: ${input_text.trim()}`
				})
			});

			const result = await fetchresult.json();

			if (!fetchresult.ok) {
				if (result.error.status == 429) {
					inputerror =
						'Enough items added for now. Try again soon or ask a student senate member for help!';
				} else {
					inputerror = 'Error occured';
				}
				loading = false;
				return;
			}

			if (result.result == true) {
				inputerror = 'This input was tagged.';
				loading = false;
				return;
			}

			await supabase
				.from('Items')
				.insert({
					item_id: crypto.randomUUID(),
					title: input_title.trim(),
					text: input_text.trim(),
					checked: false,
					deleted: false
				})
				.select();
		} else {
			await supabase
				.from('Items')
				.insert({
					item_id: crypto.randomUUID(),
					title: input_title.trim(),
					text: input_text.trim(),
					checked: false,
					date: value.toString().split('T')[0],
					deleted: false,
					dashboard: true
				})
				.select();
		}
		loading = false;
		input_title = '';
		input_text = '';
		value = today(getLocalTimeZone());
	}

	async function deleteItem(item: Item) {
		await supabase
			.from('Items')
			.update({ deleted: true })
			.eq('item_id', item.item_id) // ← Add this: filter by primary key
			.select(); // Optional: returns updated row(s)
	}

	function formatDate(dateStr: string) {
		const [year, month, day] = dateStr.split('-');
		return `${month}-${day}-${year}`;
	}
</script>

{#if dashboard}
	<NavigationMenu.Root class="flex-0">
		<NavigationMenu.List>
			<NavigationMenu.Item>
				<NavigationMenu.Link class="text-2xl hover:cursor-pointer" href="/dashboard"
					>Dashboard</NavigationMenu.Link
				>
			</NavigationMenu.Item>
		</NavigationMenu.List>
	</NavigationMenu.Root>
{/if}
<div class="mt-5 mr-5 flex justify-end">
	{#if !currentUserId}
		<Dialog.Root>
			<DialogTrigger class={buttonVariants({ variant: 'default' })} type="button">
				Sign In!
			</DialogTrigger>
			<DialogContent>
				{#if !email_sent}
					<form>
						<Field.Group>
							<Field.Field>
								<Field.Label for="email">Email</Field.Label>
								<Input
									id="email"
									bind:value={email}
									oninput={() => (error_message = '')}
									type="email"
									autocomplete="on"
								/>
							</Field.Field>
							<Field.Field>
								<Field.Label for="password">Password</Field.Label>
								<Input
									id="password"
									bind:value={password}
									oninput={() => (error_message = '')}
									type="password"
									autocomplete="on"
								/>
							</Field.Field>
							{#if error_message}
								<p class="inline-flex justify-center text-sm text-red-500">{error_message}</p>
							{/if}
							{#if signin}
								<Button class="flex place-self-center" type="button" onclick={() => signIn()}>
									Sign In
								</Button>
							{:else}
								<Button class="flex place-self-center" type="button" onclick={() => signUp()}>
									Sign Up
								</Button>
							{/if}
						</Field.Group>
					</form>
					<button class="flex place-self-center" onclick={() => (signin = !signin)}>
						<p class="hover:cursor-pointer">
							{signin ? "Don't have an account?" : 'Have an account?'}
						</p>
					</button>
				{:else}
					<p class="text-center text-3xl">Email was sent to inbox!</p>
					<Button class="flex place-self-center" onclick={() => (email_sent = !email_sent)}
						>Alright</Button
					>
				{/if}
			</DialogContent>
		</Dialog.Root>
	{:else}
		<Button onclick={() => signOut()}>Sign Out</Button>
	{/if}
</div>
<div class="mx-auto grid w-1/2 grid-cols-1">
	{#if currentUserId}
		<h6 class="text-7xl">Community</h6>
		<Field.Set class="rounded-lg border-2 border-black p-10">
			<Field.Legend class="text-4xl!">Share your idea!</Field.Legend>
			{#if loading}
				<Spinner class="ml-5 size-30 place-self-center" />
			{:else}
				<Field.Group>
					<Field.Field>
						<Field.Label for="input-title" class="text-3xl">Title</Field.Label>
						<InputGroup.Root class="h-15">
							<InputGroup.Input
								id="input-title"
								class="text-2xl!"
								contenteditable="true"
								bind:value={input_title}
								oninput={() =>
									(inputerror = 'You are not anonymous. Be mindful of what you input.')}
								maxlength={100}
							/>
							{#if dashboard}
								<InputGroupAddon align="inline-end">
									<DropdownMenu.Root>
										<DropdownMenuTrigger>
											<CalendarPlus color="black" />
										</DropdownMenuTrigger>
										<DropdownMenuContent>
											<Calendar
												type="single"
												bind:value
												class="rounded-md border shadow-sm"
												captionLayout="dropdown"
											/>
										</DropdownMenuContent>
									</DropdownMenu.Root>
								</InputGroupAddon>
							{/if}
						</InputGroup.Root>
					</Field.Field>
					<Field.Field>
						<Field.Label for="input-text" class="text-3xl">Description</Field.Label>
						<Textarea
							class="h-100 text-xl!"
							id="input-text"
							bind:value={input_text}
							oninput={() => (inputerror = 'You are not anonymous. Be mindful of what you input.')}
						/>
					</Field.Field>
				</Field.Group>
				<p class="text-center text-xl text-red-500">{inputerror}</p>
				<Button class="flex h-10 w-30 place-self-center text-3xl" onclick={itemsToList}
					>Submit</Button
				>
			{/if}
		</Field.Set>

		<HoverCard.Root>
			<HoverCard.Trigger class="mt-5 w-fit cursor-default text-4xl underline"
				>Current List:</HoverCard.Trigger
			>
			<HoverCard.Content>
				<div class="flex">
					<CircleDashed color="black" />: Pending
				</div>
				<div class="flex">
					<Check color="black" />: In Progress
				</div>
				<div class="flex">
					<CircleCheck color="black" />: Completed
				</div>
			</HoverCard.Content>
		</HoverCard.Root>
		{#if dashboard}
			<h6 class="text-green-500">
				Deleted items can always be recovered. Feel free to delete them if need be.
			</h6>
		{/if}
		{#each list as item (item.item_id)}
			<div class="my-5 flex justify-between">
				<div class="flex items-start gap-2">
					{#if dashboard && !item.dashboard}
						<AlertDialog.Root>
							<AlertDialog.Trigger>
								<SendHorizontal color="black" class="mt-0.5" /></AlertDialog.Trigger
							>
							<AlertDialog.Content>
								<AlertDialog.Title class="text-center">Dashboard Addition</AlertDialog.Title>
								<AlertDialog.Description class="text-center"
									>Pressing Confirm below will move this item to the shared dashboard.</AlertDialog.Description
								>
								<AlertDialog.Action onclick={() => dashboardAdd(item)}>Confirm</AlertDialog.Action>
								<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
							</AlertDialog.Content>
						</AlertDialog.Root>
					{/if}
					{#if !item.checked}
						{#if item.dashboard}
							<Check class="shrink-0" color="black" />
						{:else}
							<CircleDashed class="shrink-0" color="black" />
						{/if}
						<Collapsible.Root>
							<Collapsible.Trigger class="cursor-pointer">
								<p class={cn(item.checked ? 'line-through' : '', 'text-2xl wrap-break-word')}>
									{item.title}
								</p></Collapsible.Trigger
							>
							<Collapsible.Content>
								<p class="text-xl wrap-break-word">{item.text}</p>
							</Collapsible.Content>
						</Collapsible.Root>
					{:else}
						<CircleCheck color="black" class="mt-0.5" />
						<p class={cn(item.checked ? 'line-through' : '', 'text-2xl wrap-break-word')}>
							{item.title}
						</p>
					{/if}
				</div>
				<div class="flex shrink-0 gap-5">
					{formatDate(item.date)}
					{#if dashboard}
						<Trash2 color="black" size="20" onclick={() => deleteItem(item)} />
					{/if}
				</div>
			</div>
		{/each}
	{:else}
		<h6 class="mb-10 text-center text-2xl">
			Ever been in the situation where you had a genius idea for our school but didn't know the best
			way to reach our Student Senate?
		</h6>
		<h6 class="text-center text-2xl">
			This is the tool for you! Reach Student Senate easily and share your ideas here!
		</h6>
		<h6 class="text-center text-2xl">Please sign in to participate.</h6>
	{/if}
</div>
