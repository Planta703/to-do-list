<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import DropdownMenuContent from '@/components/ui/dropdown-menu/dropdown-menu-content.svelte';
	import DropdownMenuTrigger from '@/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
	import InputGroupAddon from '@/components/ui/input-group/input-group-addon.svelte';
	import { getLocalTimeZone, today, parseDate } from '@internationalized/date';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import Button from '@/components/ui/button/button.svelte';
	import { supabase } from '$lib/supabaseClient.js';
	import { onMount, onDestroy } from 'svelte';
	import { CalendarPlus, ChevronDown, Trash2, SendHorizontal } from '@lucide/svelte';
	import { cn } from '@/utils';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Textarea } from '@/components/ui/textarea';

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
	let currentUserId = $state('');
	let input_text = $state('');
	let inputerror = $state('');

	supabase.auth.onAuthStateChange((event) => {
		if (event === 'SIGNED_OUT') window.location.href = '/';
	});

	async function accountPresent() {
		const {
			data: { user }
		} = await supabase.auth.getUser();
		if (!user) {
			window.location.href = '/';
			return;
		} else {
			currentUserId = user.id;
			const { data: userData } = await supabase
				.from('users')
				.select('*')
				.eq('type', 'dashboard')
				.eq('user_id', currentUserId);
			if (!userData || userData.length === 0) {
				window.location.href = '/';
			}
		}
	}

	onMount(() => {
		accountPresent();
		loadItems();

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
						if (row.deleted || !row.dashboard) {
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
		const { data } = await supabase
			.from('Items')
			.select('*')
			.eq('deleted', false)
			.eq('dashboard', true);
		list = data ?? [];
	}

	async function check(item: Item) {
		await supabase
			.from('Items')
			.update({ checked: item.checked })
			.eq('item_id', item.item_id) // ← Add this: filter by primary key
			.select(); // Optional: returns updated row(s)
	}

	async function updateDate(item: Item) {
		await supabase.from('Items').update({ date: item.date }).eq('item_id', item.item_id).select();
	}

	async function deleteItem(item: Item) {
		await supabase
			.from('Items')
			.update({ deleted: true })
			.eq('item_id', item.item_id) // ← Add this: filter by primary key
			.select(); // Optional: returns updated row(s)
	}

	async function signOut() {
		await supabase.auth.signOut({ scope: 'local' });
	}

	$effect(() => {
		list.sort((a, b) => {
			if (a.checked !== b.checked) {
				return Number(a.checked) - Number(b.checked);
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

	async function itemsToList() {
		if (!input_title.trim()) {
			inputerror = 'Please enter title!';
			return;
		}
		if (!input_text.trim()) {
			inputerror = 'Please enter description!';
			return;
		}
		await supabase
			.from('Items')
			.insert({
				title: input_text.trim(),
				text: input_title.trim(),
				date: value.toString().split('T')[0],
				dashboard: true
			})
			.select();
		input_title = '';
		input_text = '';
		value = today(getLocalTimeZone());
	}

	async function dashboardRemove(item: Item) {
		await supabase.from('Items').update({ dashboard: false }).eq('item_id', item.item_id).select();
	}
</script>

<NavigationMenu.Root class="flex-0">
	<NavigationMenu.List>
		<NavigationMenu.Item>
			<NavigationMenu.Link class="text-2xl hover:cursor-pointer" href="/"
				>Community</NavigationMenu.Link
			>
		</NavigationMenu.Item>
	</NavigationMenu.List>
</NavigationMenu.Root>
<div class="mt-5 mr-5 flex justify-end">
	<Button onclick={() => signOut()}>Sign Out</Button>
</div>
<div class="mx-auto grid w-1/2 grid-cols-1">
	<h6 class="font-chewy text-7xl">Dashboard</h6>
	<p class="my-10 text-center text-xl text-red-500">{inputerror}</p>
	<Field.Set class="rounded-lg border-2 border-black p-10">
		<Field.Legend class="text-4xl!">Share your idea!</Field.Legend>
		<Field.Group>
			<Field.Field>
				<Field.Label for="input-title" class="text-3xl">Title</Field.Label>
				<InputGroup.Root class="h-15">
					<InputGroup.Input
						id="input-title"
						class="text-2xl!"
						contenteditable="true"
						bind:value={input_title}
						maxlength={100}
					/>
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
				</InputGroup.Root>
			</Field.Field>
			<Field.Field>
				<Field.Label for="input-text" class="text-3xl">Description</Field.Label>
				<Textarea class="text-xl!" id="input-text" bind:value={input_text} />
			</Field.Field>
		</Field.Group>
		<Button class="flex h-10 w-30 place-self-center text-3xl" onclick={itemsToList}>Submit</Button>
	</Field.Set>
	{#each list as item (item.item_id)}
		<div class="my-5 flex justify-between">
			<div class="flex place-items-center gap-2">
				<SendHorizontal class="black scale-x-[-1]" onclick={() => dashboardRemove(item)} />
				<Checkbox
					class="black size-7"
					id={item.item_id}
					onCheckedChange={() => check(item)}
					bind:checked={item.checked}
				/>
				<Label for={item.item_id} class={cn(item.checked ? 'line-through' : '', 'text-2xl')}
					>{item.text}</Label
				>
			</div>
			<div class="flex items-center gap-5">
				<DropdownMenu.Root>
					<DropdownMenuTrigger class="flex items-center gap-1">
						{item.date}
						<ChevronDown color="black" />
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<Calendar
							type="single"
							value={parseDate(item.date)}
							onValueChange={(newVal) => {
								if (newVal) item.date = newVal.toString();
								updateDate(item);
							}}
							class="rounded-md border shadow-sm"
							captionLayout="dropdown"
						/>
					</DropdownMenuContent>
				</DropdownMenu.Root>
				<Trash2 color="black" size="20" onclick={() => deleteItem(item)} />
			</div>
		</div>
	{/each}
</div>
